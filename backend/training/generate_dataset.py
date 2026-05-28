"""
Synthetic training-data generator for the Form Engine YAML.

Calls the Anthropic API to produce (natural-language description → YAML manifest)
pairs across varied domains and complexity tiers, validates every YAML against
the real FormManifest pydantic model, and appends each surviving pair as one
JSON line to `dataset.jsonl`.

Run:
    cd backend
    export ANTHROPIC_API_KEY=sk-ant-...
    python -m training.generate_dataset --count 80

The script is resumable — re-running it skips entries already present in the
output file (keyed by description hash), so an interruption costs nothing.
"""
from __future__ import annotations
import argparse, hashlib, json, os, pathlib, random, sys, time
from typing import Any

import httpx
import yaml

# Make `backend.*` importable when invoked as `python -m training.generate_dataset`
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent.parent))
from backend.models.form_schema import FormManifest  # noqa: E402
from backend.services.exemplar_pack import _SCHEMA_REFERENCE, _read_exemplar  # noqa: E402

CLAUDE_API   = "https://api.anthropic.com/v1/messages"
MODEL        = os.environ.get("DATASET_MODEL", "claude-sonnet-4-5")
DEFAULT_OUT  = pathlib.Path(__file__).parent / "dataset.jsonl"

# Diverse domains so the model doesn't overfit on HR / insurance patterns.
DOMAINS = [
    "healthcare patient intake", "veterinary clinic visit", "real estate listing",
    "rental application", "K-12 school enrollment", "university course registration",
    "event RSVP", "conference speaker submission", "restaurant reservation",
    "food allergy declaration", "e-commerce returns request", "warranty claim",
    "IT support ticket", "bug report", "feature request",
    "non-profit volunteer signup", "donation pledge", "grant application",
    "expense reimbursement", "purchase requisition",
    "employee performance review", "exit interview", "training enrollment",
    "vendor onboarding", "KYC / identity verification",
    "loan application", "credit-card dispute", "insurance claim",
    "passport / visa application", "tax filing intake",
    "marathon registration", "gym membership signup", "fitness class booking",
    "wedding RSVP", "birthday party planner",
    "podcast guest application", "freelance gig brief", "research participant screening",
    "vehicle service booking", "moving-service quote",
    "pet adoption application", "childcare enrollment",
    "telehealth pre-visit questionnaire", "mental-health screening",
    "anonymous workplace whistleblower report",
]

COMPLEXITY_TIERS = [
    ("simple",   "Single-page, 1 section, 4-6 fields, no conditions."),
    ("medium",   "Single-page, 2-3 sections, 8-14 fields, at least one named condition."),
    ("branchy",  "Single-page, 3-5 sections, named conditions controlling section visibility, "
                 "at least one composite (all/any) condition."),
    ("wizard",   "Wizard layout with 3+ pages, conditional sections, mixed field types "
                 "including date, multiselect, and number."),
]

SYSTEM_PROMPT = f"""\
You are a Form Engine YAML generator. Given a brief, produce ONE manifest that
strictly follows the schema below. Output a SINGLE markdown YAML fenced block
and nothing else — no commentary, no explanation, no second code block.

The manifest MUST be loadable by the real engine. Common pitfalls to avoid:
  - `choices:` requires a `static:` wrapper around the list
  - condition ops must be from the documented set (eq, neq, in, gte, contains, is_true, ...)
  - field IDs must be snake_case and unique within the form
  - `layout.type` is either `single-page` or `wizard` (wizard uses `pages:`, single uses `sections:`)
  - never invent field types — stick to: text, multiline, number, boolean, select, multiselect, date, time, rating, file

{_SCHEMA_REFERENCE}

REAL EXEMPLAR (your output should follow this shape):
```yaml
{_read_exemplar("auth_forms.yaml")}
```
"""

USER_TEMPLATE = """\
Generate ONE Form Engine YAML manifest for this brief.

Domain:      {domain}
Complexity:  {tier} — {tier_hint}
Manifest ID: {mid} (use this exact value)

Make the field set realistic for the domain. Vary `display_as`, `default`,
`placeholder`, and `hint` so the dataset doesn't look templated. Output only
the YAML in a single ```yaml fenced block.
"""


def _slug(text: str) -> str:
    return "".join(c if c.isalnum() else "_" for c in text.lower()).strip("_")


def _extract_yaml(raw: str) -> str | None:
    """Pull the first ```yaml ... ``` block out of the model's reply."""
    import re
    m = re.search(r"```(?:yaml)?\s*([\s\S]*?)```", raw)
    return m.group(1).strip() if m else None


def _validate(yaml_text: str) -> tuple[bool, str]:
    """Returns (ok, error_message). Empty error on success."""
    try:
        body = yaml.safe_load(yaml_text)
    except yaml.YAMLError as e:
        return False, f"yaml parse: {e}"
    if not isinstance(body, dict):
        return False, "top-level is not a mapping"
    try:
        FormManifest.model_validate(body)
    except Exception as e:
        return False, f"schema: {str(e)[:200]}"
    return True, ""


def _load_existing(path: pathlib.Path) -> set[str]:
    if not path.exists():
        return set()
    seen: set[str] = set()
    with path.open(encoding="utf-8") as f:
        for line in f:
            try:
                rec = json.loads(line)
                seen.add(rec.get("hash", ""))
            except json.JSONDecodeError:
                continue
    return seen


def _call_claude(api_key: str, user_msg: str) -> tuple[str, int, int]:
    payload = {
        "model": MODEL,
        "max_tokens": 4096,
        "system": SYSTEM_PROMPT,
        "messages": [{"role": "user", "content": user_msg}],
    }
    with httpx.Client(timeout=120) as client:
        res = client.post(
            CLAUDE_API,
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json=payload,
        )
    res.raise_for_status()
    data = res.json()
    text = data.get("content", [{}])[0].get("text", "")
    usage = data.get("usage", {})
    return text, usage.get("input_tokens", 0), usage.get("output_tokens", 0)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--count", type=int, default=80, help="Target number of valid pairs.")
    ap.add_argument("--output", type=pathlib.Path, default=DEFAULT_OUT)
    ap.add_argument("--max-attempts", type=int, default=3,
                    help="Retry budget per pair when YAML fails validation.")
    args = ap.parse_args()

    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        print("ERROR: ANTHROPIC_API_KEY not set.", file=sys.stderr)
        return 1

    args.output.parent.mkdir(parents=True, exist_ok=True)
    seen = _load_existing(args.output)
    print(f"[start] resume: {len(seen)} existing entries in {args.output.name}")

    written  = len(seen)
    in_toks  = 0
    out_toks = 0
    rng      = random.Random(42)

    with args.output.open("a", encoding="utf-8") as fout:
        while written < args.count:
            domain = rng.choice(DOMAINS)
            tier, tier_hint = rng.choice(COMPLEXITY_TIERS)
            mid = f"{_slug(domain)}_{rng.randint(1000, 9999)}"
            description = f"A {tier} form for {domain}."
            h = hashlib.sha1(f"{mid}|{description}".encode()).hexdigest()[:12]
            if h in seen:
                continue

            user_msg = USER_TEMPLATE.format(
                domain=domain, tier=tier, tier_hint=tier_hint, mid=mid,
            )

            success = False
            for attempt in range(1, args.max_attempts + 1):
                try:
                    raw, ti, to = _call_claude(api_key, user_msg)
                except httpx.HTTPStatusError as e:
                    print(f"  [api {e.response.status_code}] backing off…")
                    time.sleep(5)
                    continue
                in_toks  += ti
                out_toks += to
                yaml_text = _extract_yaml(raw)
                if not yaml_text:
                    print(f"  [attempt {attempt}] no yaml block in reply")
                    continue
                ok, err = _validate(yaml_text)
                if not ok:
                    print(f"  [attempt {attempt}] invalid: {err}")
                    user_msg += f"\n\nPrevious attempt failed validation: {err}\nRegenerate, fixing this."
                    continue

                rec = {
                    "hash": h,
                    "domain": domain,
                    "complexity": tier,
                    "description": description,
                    "yaml": yaml_text,
                }
                fout.write(json.dumps(rec, ensure_ascii=False) + "\n")
                fout.flush()
                seen.add(h)
                written += 1
                success = True
                print(f"[{written:>3}/{args.count}] ok  {tier:<8} {domain}")
                break

            if not success:
                print(f"  [skip] gave up after {args.max_attempts} attempts on {domain}")

    cost_in   = in_toks  / 1_000_000 * 3.0   # claude-sonnet-4-5 indicative pricing
    cost_out  = out_toks / 1_000_000 * 15.0
    print(
        f"\n[done] {written} pairs in {args.output}\n"
        f"       tokens in={in_toks:,} out={out_toks:,}\n"
        f"       est. cost ≈ ${cost_in + cost_out:.2f} USD"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
