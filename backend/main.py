"""
Form Engine API — FastAPI entry point.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn, json

from .routers.forms import router as forms_router, _manifests, _meta
from .routers.submissions import router as submissions_router
from .routers.create_form import router as create_form_router
from .routers.categories import router as categories_router
from .routers.ai_chat import router as ai_router
from .routers.auth import router as auth_router
from .routers.uam_directory import router as uam_directory_router
from .middleware.security import SecurityHeadersMiddleware, RequestSizeLimitMiddleware
import datetime

app = FastAPI(
    title="Form Engine API",
    description="Dynamic form management and submission API based on FormEngineManifest v4.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(RequestSizeLimitMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:3001", "http://web:3000"],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1|\[::1\])(:[0-9]+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(forms_router)
app.include_router(submissions_router)
app.include_router(create_form_router)
app.include_router(categories_router)
app.include_router(ai_router)
app.include_router(uam_directory_router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "form-engine-api"}


# ── Seed sample manifest on startup ──────────────────────────────────────────
SAMPLE_MANIFEST = {
    "manifest_id": "hr_forms",
    "manifest_version": "1.0.0",
    "engine": {"mode": "reactive", "evaluation_order": "dependency", "error_mode": "collect-all", "debounce_ms": 300},
    "namespaces": ["core", "schemata", "uam", "form", "ui"],
    "conditions": {
        "is_employed": {"expression": "fields.employment_status == 'employed'"},
        "has_dependents": {"expression": "fields.has_dependents == true"},
        "needs_visa": {"expression": "fields.nationality != 'IN'"},
    },
    "forms": {
        "employee_onboarding": {
            "title": "Employee Onboarding",
            "description": "Welcome! Please complete all sections to finish your onboarding.",
            "version": "1.0.0",
            "form_state": "active",
            "layout": {"type": "wizard"},
            "submit_label": "Complete Onboarding",
            "draft_label": "Save Progress",
            "on_submit": {"type": "rest", "url": "/api/submissions/", "method": "POST",
                          "success_message": "🎉 Welcome aboard! Your profile is complete."},
            "pages": [
                {
                    "id": "personal",
                    "title": "Personal Details",
                    "icon": "User",
                    "sections": [{
                        "id": "personal_info",
                        "title": "Personal Information",
                        "fields": [
                            {"id": "first_name", "type": "text", "label": "First Name", "required": True,
                             "width": "half", "autocomplete": "given-name", "max_length": 60},
                            {"id": "last_name", "type": "text", "label": "Last Name", "required": True,
                             "width": "half", "autocomplete": "family-name", "max_length": 60},
                            {"id": "email", "type": "text", "label": "Work Email", "required": True,
                             "autocomplete": "email", "placeholder": "you@company.com",
                             "pattern": "^[\\w.-]+@[\\w.-]+\\.[a-zA-Z]{2,}$",
                             "pattern_message": "Please enter a valid email address"},
                            {"id": "phone", "type": "text", "label": "Phone Number", "required": True,
                             "autocomplete": "tel", "placeholder": "+91 98765 43210", "width": "half"},
                            {"id": "dob", "type": "date", "label": "Date of Birth",
                             "max_date": "today-18y", "width": "half"},
                            {"id": "nationality", "type": "select", "label": "Nationality", "required": True,
                             "width": "half",
                             "choices": [
                                 {"value": "IN", "label": "Indian"},
                                 {"value": "US", "label": "American"},
                                 {"value": "GB", "label": "British"},
                                 {"value": "SG", "label": "Singaporean"},
                                 {"value": "OTHER", "label": "Other"}
                             ]},
                            {"id": "gender", "type": "select", "label": "Gender", "width": "half",
                             "display_as": "button-group",
                             "choices": [
                                 {"value": "male", "label": "Male"},
                                 {"value": "female", "label": "Female"},
                                 {"value": "other", "label": "Other"},
                                 {"value": "prefer_not", "label": "Prefer not to say"}
                             ]},
                        ]
                    }]
                },
                {
                    "id": "employment",
                    "title": "Employment Details",
                    "icon": "Briefcase",
                    "sections": [{
                        "id": "job_info",
                        "title": "Job Information",
                        "fields": [
                            {"id": "job_title", "type": "text", "label": "Job Title", "required": True,
                             "placeholder": "Software Engineer"},
                            {"id": "department", "type": "select", "label": "Department", "required": True,
                             "choices": [
                                 {"value": "engineering", "label": "Engineering"},
                                 {"value": "product", "label": "Product"},
                                 {"value": "design", "label": "Design"},
                                 {"value": "sales", "label": "Sales"},
                                 {"value": "hr", "label": "Human Resources"},
                                 {"value": "finance", "label": "Finance"},
                                 {"value": "marketing", "label": "Marketing"},
                             ]},
                            {"id": "start_date", "type": "date", "label": "Start Date", "required": True,
                             "use_current": False, "width": "half"},
                            {"id": "employment_type", "type": "select", "label": "Employment Type",
                             "required": True, "width": "half", "display_as": "radio",
                             "choices": [
                                 {"value": "full_time", "label": "Full Time"},
                                 {"value": "part_time", "label": "Part Time"},
                                 {"value": "contract", "label": "Contract"},
                             ]},
                            {"id": "salary", "type": "number", "label": "Annual Salary (INR)",
                             "prefix": "₹", "number_type": "decimal2", "min": 0, "width": "half",
                             "confidentiality": "Confidential"},
                            {"id": "reports_to", "type": "text", "label": "Reporting Manager",
                             "placeholder": "Manager name or email", "width": "half"},
                        ]
                    }]
                },
                {
                    "id": "emergency",
                    "title": "Emergency & Additional",
                    "icon": "Heart",
                    "sections": [
                        {
                            "id": "emergency_contact",
                            "title": "Emergency Contact",
                            "fields": [
                                {"id": "ec_name", "type": "text", "label": "Contact Name", "required": True,
                                 "width": "half"},
                                {"id": "ec_relationship", "type": "select", "label": "Relationship",
                                 "width": "half",
                                 "choices": [
                                     {"value": "spouse", "label": "Spouse / Partner"},
                                     {"value": "parent", "label": "Parent"},
                                     {"value": "sibling", "label": "Sibling"},
                                     {"value": "child", "label": "Child"},
                                     {"value": "friend", "label": "Friend"},
                                     {"value": "other", "label": "Other"},
                                 ]},
                                {"id": "ec_phone", "type": "text", "label": "Contact Phone", "required": True,
                                 "width": "half"},
                            ]
                        },
                        {
                            "id": "preferences",
                            "title": "Work Preferences",
                            "fields": [
                                {"id": "remote_preference", "type": "select",
                                 "label": "Work Mode Preference",
                                 "display_as": "radio",
                                 "choices": [
                                     {"value": "office", "label": "Office"},
                                     {"value": "hybrid", "label": "Hybrid"},
                                     {"value": "remote", "label": "Remote"},
                                 ]},
                                {"id": "skills", "type": "multiselect", "label": "Primary Skills",
                                 "display_as": "tag-input",
                                 "choices": [
                                     {"value": "python", "label": "Python"},
                                     {"value": "typescript", "label": "TypeScript"},
                                     {"value": "react", "label": "React"},
                                     {"value": "golang", "label": "Go"},
                                     {"value": "java", "label": "Java"},
                                     {"value": "devops", "label": "DevOps"},
                                     {"value": "ml", "label": "Machine Learning"},
                                     {"value": "ux", "label": "UX Design"},
                                     {"value": "pm", "label": "Product Management"},
                                 ], "allow_others": True},
                                {"id": "bio", "type": "multiline", "label": "Short Bio",
                                 "placeholder": "Tell us a little about yourself...",
                                 "rows": 4, "max_length": 500},
                                {"id": "terms_accepted", "type": "boolean",
                                 "label": "I accept the employee handbook and code of conduct",
                                 "required": True, "display_as": "checkbox"},
                            ]
                        }
                    ]
                }
            ]
        },
        "feedback_survey": {
            "title": "Team Feedback Survey",
            "description": "Help us improve by sharing your honest feedback.",
            "version": "1.0.0",
            "form_state": "active",
            "layout": {"type": "single-page"},
            "submit_label": "Submit Feedback",
            "on_submit": {"type": "local", "handler_name": "handleFeedback",
                          "success_message": "Thank you for your feedback!"},
            "sections": [
                {
                    "id": "ratings",
                    "title": "Rate Your Experience",
                    "fields": [
                        {"id": "overall_rating", "type": "rating", "label": "Overall Satisfaction",
                         "required": True, "max": 5, "display_as": "stars",
                         "low_label": "Very Unsatisfied", "high_label": "Very Satisfied"},
                        {"id": "work_life_balance", "type": "rating",
                         "label": "Work-Life Balance", "max": 5, "display_as": "numeric-scale"},
                        {"id": "team_collaboration", "type": "rating",
                         "label": "Team Collaboration", "max": 5, "display_as": "stars"},
                        {"id": "management_support", "type": "rating",
                         "label": "Management Support", "max": 5, "display_as": "stars"},
                    ]
                },
                {
                    "id": "questions",
                    "title": "Open Questions",
                    "fields": [
                        {"id": "highlight", "type": "multiline", "label": "What is going well?",
                         "placeholder": "Share what you appreciate...", "rows": 3},
                        {"id": "improvement", "type": "multiline",
                         "label": "What could be improved?",
                         "placeholder": "Your suggestions are valuable...", "rows": 3},
                        {"id": "recommend", "type": "select",
                         "label": "Would you recommend working here?",
                         "display_as": "radio",
                         "choices": [
                             {"value": "definitely", "label": "Definitely"},
                             {"value": "probably", "label": "Probably"},
                             {"value": "unsure", "label": "Not sure"},
                             {"value": "no", "label": "Probably not"},
                         ]},
                        {"id": "anonymous", "type": "boolean",
                         "label": "Submit anonymously",
                         "display_as": "switch", "default": True},
                    ]
                }
            ]
        }
    }
}




def _wrap_choices(obj):
    """Recursively wrap bare choice lists so they conform to ChoiceSource."""
    if isinstance(obj, dict):
        for k in list(obj.keys()):
            if k == 'choices' and isinstance(obj[k], list):
                obj[k] = {'static': obj[k]}
            else:
                _wrap_choices(obj[k])
    elif isinstance(obj, list):
        for item in obj:
            _wrap_choices(item)

@app.on_event("startup")
async def seed_sample_data():
    now = datetime.datetime.utcnow().isoformat()
    mid = SAMPLE_MANIFEST["manifest_id"]
    _wrap_choices(SAMPLE_MANIFEST)
    _manifests[mid] = SAMPLE_MANIFEST
    _meta[mid] = {"created_at": now, "updated_at": now}
    print(f"[seed] Manifest: {mid}")


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)


# ── Auto-seed sample_forms/ directory on startup ────────────────────────────
import os, pathlib

@app.on_event("startup")
async def seed_sample_files():
    sample_dir = pathlib.Path(__file__).parent / "sample_forms"
    if not sample_dir.exists():
        return
    for f in sample_dir.glob("*.yaml"):
        try:
            import yaml as _yaml
            body = _yaml.safe_load(f.read_text(encoding="utf-8"))
            from .models.form_schema import FormManifest as FM
            m = FM.model_validate(body)
            mid = m.manifest_id or f.stem
            if mid in _manifests:
                continue          # don't overwrite user data
            body["manifest_id"] = mid
            _manifests[mid] = body
            _manifests[mid]["_category_name"] = mid.replace("_", " ").title()
            _meta[mid] = {"created_at": datetime.datetime.utcnow().isoformat(),
                          "updated_at": datetime.datetime.utcnow().isoformat()}
            print(f"  [seed] sample: {mid}")
        except Exception as e:
            print(f"  [seed] skipped {f.name}: {e}")
