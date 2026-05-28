"use client";

import React, { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/api";
import { FormEngine } from "@form-engine/components/FormEngine";
import type { FormManifest, FieldAnswers } from "@form-engine/libs/types";
import { cn } from "@form-engine/libs/utils";
import { toast } from "sonner";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  form?: { manifest: FormManifest; formId: string };
  timestamp: Date;
}

type ChatMode = "fill" | "create" | "help";

// ─── AI chat helper (backend picks provider: anthropic | ollama) ──────────────
async function callClaude(
  systemPrompt: string,
  messages: { role: "user" | "assistant"; content: string }[],
  mode: ChatMode,
): Promise<string> {
  const res = await fetch("/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ system: systemPrompt, messages, mode }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "AI error" }));
    throw new Error(err.detail ?? `HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.response ?? "";
}

// ─── System prompts ────────────────────────────────────────────────────────────
function buildSystemPrompt(mode: ChatMode, manifest: FormManifest | null, formId: string | null, answers: FieldAnswers): string {
  const base = `You are a helpful Form Engine assistant. Be concise, friendly, and practical.
Today's date: ${new Date().toISOString().split("T")[0]}.`;

  if (mode === "fill" && manifest && formId) {
    const form = manifest.forms?.[formId];
    const fields = (form?.pages ?? []).flatMap(p => p.sections.flatMap(s => s.fields ?? []))
      .concat((form?.sections ?? []).flatMap(s => s.fields ?? []));
    const fieldList = fields.map(f => `- ${f.id}: ${(f as unknown as Record<string,unknown>).label ?? f.id} (${(f as unknown as Record<string,unknown>).type}${(f as unknown as Record<string,unknown>).required ? ", required" : ""})`).join("\n");
    const currentAnswers = JSON.stringify(answers, null, 2);
    return `${base}
You are helping the user fill out the form: "${form?.title ?? formId}".
${form?.description ? `Form description: ${form.description}` : ""}

FIELDS:
${fieldList}

CURRENT ANSWERS:
${currentAnswers}

Your job:
1. Guide the user through filling the form step-by-step.
2. When the user provides a value for a field, respond with a JSON block like: \`\`\`json\n{"setField": "field_id", "value": <value>}\`\`\`
3. For multiple values: \`\`\`json\n{"setFields": {"field1": val1, "field2": val2}}\`\`\`
4. Validate answers and point out issues.
5. When all required fields are filled, ask the user if they want to submit.
6. If the user asks to submit, respond with: \`\`\`json\n{"action": "submit"}\`\`\`
Keep responses short (2-3 sentences max) unless the user asks for more detail.`;
  }

  if (mode === "create") {
    return `${base}
You are helping the user create a new form using the Form Engine Builder.
When the user describes a form they want to create, generate a YAML manifest.
Always wrap the YAML in a code block: \`\`\`yaml\n...\`\`\`
The manifest MUST follow this schema:
- manifest_id: snake_case identifier
- forms:
    form_id:
      title: string
      version: "1.0.0"
      layout: {type: single-page | wizard}
      sections: [{id, title, fields: [{id, type, label, ...}]}]
      on_submit: {type: none}

Field types: text, multiline, number, boolean, select, multiselect, date, time, rating, file
For select/multiselect, include: choices: [{value, label}]
Keep YAML clean and valid. After generating, ask if they want to load it.
When the user confirms, respond with: \`\`\`json\n{"action": "loadYaml"}\`\`\``;
  }

  return `${base}
You help users understand and use the Form Engine.
You can:
- Explain how to create forms (YAML structure, field types, conditions, validation)
- Help debug form YAML issues
- Explain concepts like wizard pages, conditions, computed fields
- Guide users to the right tool: /create (Form Builder), /builder (YAML Editor), /chat (AI Chat)
Be helpful and precise. Use code blocks for YAML examples.`;
}

// ─── Parse Claude response for actions ─────────────────────────────────────────
interface ParsedAction {
  text: string;
  setField?: { id: string; value: unknown };
  setFields?: Record<string, unknown>;
  action?: "submit" | "loadYaml";
  yaml?: string;
}

function parseResponse(raw: string): ParsedAction {
  let text = raw;
  let setField: ParsedAction["setField"];
  let setFields: ParsedAction["setFields"];
  let action: ParsedAction["action"];
  let yaml: string | undefined;

  // Extract JSON blocks
  const jsonMatches = [...raw.matchAll(/```json\s*([\s\S]*?)```/g)];
  for (const m of jsonMatches) {
    try {
      const parsed = JSON.parse(m[1]);
      if (parsed.setField) setField = { id: parsed.setField, value: parsed.value };
      if (parsed.setFields) setFields = parsed.setFields;
      if (parsed.action) action = parsed.action;
    } catch { /* malformed JSON block */ }
    text = text.replace(m[0], "").trim();
  }

  // Extract YAML blocks
  const yamlMatch = raw.match(/```yaml\s*([\s\S]*?)```/);
  if (yamlMatch) {
    yaml = yamlMatch[1].trim();
    text = text.replace(yamlMatch[0], "").trim();
  }

  return { text: text.trim(), setField, setFields, action, yaml };
}

// ─── ChatPage ─────────────────────────────────────────────────────────────────
function ChatPageInner() {
  const searchParams = useSearchParams();
  const manifestId = searchParams.get("manifest");
  const formId     = searchParams.get("form");

  const [mode, setMode] = useState<ChatMode>(formId ? "fill" : "help");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [manifest, setManifest] = useState<FormManifest | null>(null);
  const [activeFid, setActiveFid] = useState(formId ?? "");
  const [answers, setAnswers] = useState<FieldAnswers>({});
  const [panelManifest, setPanelManifest] = useState<FormManifest | null>(null);
  const [panelFid, setPanelFid] = useState("");
  const [showPanel, setShowPanel] = useState(true);

  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load manifest if specified in URL
  useEffect(() => {
    if (!manifestId) return;
    api.getManifest(manifestId).then(m => {
      setManifest(m);
      const fids = Object.keys(m.forms ?? {});
      const fid = formId ?? fids[0] ?? "";
      setActiveFid(fid);
      setPanelManifest(m);
      setPanelFid(fid);
    }).catch(() => toast.error("Failed to load form"));
  }, [manifestId, formId]);

  // Add welcome message
  useEffect(() => {
    const welcomes: Record<ChatMode, string> = {
      fill: manifest && activeFid
        ? `Hi! I'll help you fill out **${manifest.forms?.[activeFid]?.title ?? activeFid}**. The form is shown on the right — you can either fill it directly or tell me your answers and I'll update it for you. What would you like to start with?`
        : "Hi! I'm ready to help you fill a form. Share a form URL or paste the manifest ID to get started.",
      create: "Hi! Tell me what kind of form you'd like to create and I'll generate the YAML for you. For example: *\"Create a 3-step onboarding form with name, email, department, and start date\"*",
      help: "Hi! I can help you with the Form Engine — creating forms, understanding the YAML schema, conditions, validation, or anything else. What would you like to know?",
    };
    setMessages([{
      id: "welcome",
      role: "assistant",
      content: welcomes[mode],
      timestamp: new Date(),
    }]);
  }, [mode]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSetAnswer = useCallback((fieldId: string, value: unknown) => {
    setAnswers(prev => ({ ...prev, [fieldId]: value }));
  }, []);

  const sendMessage = async (text: string) => {
    if (!text.trim() || thinking) return;
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text.trim(), timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setThinking(true);

    try {
      const history = messages.filter(m => m.role !== "assistant" || m.id !== "welcome").map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));
      history.push({ role: "user", content: text.trim() });

      const system = buildSystemPrompt(mode, manifest, activeFid, answers);
      const rawReply = await callClaude(system, history, mode);
      const parsed = parseResponse(rawReply);

      // Handle actions
      if (parsed.setField) {
        handleSetAnswer(parsed.setField.id, parsed.setField.value);
      }
      if (parsed.setFields) {
        setAnswers(prev => ({ ...prev, ...parsed.setFields }));
      }
      if (parsed.action === "submit" && manifest && activeFid) {
        try {
          const res = await api.submit({ form_id: activeFid, manifest_id: manifest.manifest_id, answers });
          if (res.status === "accepted") {
            toast.success("Form submitted!", { description: `ID: ${res.submission_id}` });
          }
        } catch { toast.error("Submission failed"); }
      }
      if (parsed.action === "loadYaml" && parsed.yaml) {
        try {
          const { parse } = await import("yaml");
          const m = parse(parsed.yaml) as FormManifest;
          const fids = Object.keys(m.forms ?? {});
          setPanelManifest(m);
          setPanelFid(fids[0] ?? "");
          setManifest(m);
          setActiveFid(fids[0] ?? "");
          toast.success("Form loaded in preview panel!");
        } catch (e) { toast.error("Invalid YAML"); }
      }

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: parsed.text || (parsed.action ? "Done!" : "…"),
        timestamp: new Date(),
      };
      if (parsed.yaml && !parsed.action) {
        assistantMsg.content += "\n\n```yaml\n" + parsed.yaml + "\n```";
      }
      setMessages(prev => [...prev, assistantMsg]);
    } catch (e: unknown) {
      const errMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `Sorry, I ran into an error: ${e instanceof Error ? e.message : "Unknown error"}. Please try again.`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setThinking(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-2.5">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <Link href="/" className="text-gray-400 hover:text-blue-600 text-sm">⬅</Link>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <span className="text-sm font-semibold text-gray-800 dark:text-white">Form Assistant</span>

          {/* Mode tabs */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 ml-4">
            {([
              { id: "help",   label: "💬 Help" },
              { id: "fill",   label: "✏️ Fill Form" },
              { id: "create", label: "⚡ Create Form" },
            ] as { id: ChatMode; label: string }[]).map(m => (
              <button key={m.id} onClick={() => setMode(m.id)}
                className={cn("px-3 py-1 text-xs font-medium rounded-md transition-all",
                  mode === m.id ? "bg-white dark:bg-gray-700 text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700")}>
                {m.label}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            {panelManifest && (
              <button onClick={() => setShowPanel(s => !s)}
                className="text-xs btn-secondary py-1.5">
                {showPanel ? "Hide Form" : "Show Form"}
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden max-w-7xl mx-auto w-full">
        {/* Chat panel */}
        <div className={cn(
          "flex flex-col bg-white dark:bg-gray-900",
          showPanel && panelManifest ? "w-full md:w-1/2 border-r border-gray-200 dark:border-gray-800" : "w-full"
        )}>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map(msg => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
            {thinking && (
              <div className="flex gap-3">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs flex-shrink-0">⚡</div>
                <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex gap-1 items-center h-4">
                    {[0, 1, 2].map(i => (
                      <span key={i} className="h-2 w-2 rounded-full bg-gray-400 animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Suggestions */}
          {messages.length <= 2 && (
            <div className="px-4 pb-2 flex flex-wrap gap-2">
              {mode === "create" && [
                "Create a job application form",
                "Build a 3-step customer onboarding wizard",
                "Make a simple feedback survey",
              ].map(s => (
                <button key={s} onClick={() => sendMessage(s)}
                  className="text-xs px-3 py-1.5 rounded-full border border-gray-200 hover:border-blue-400 hover:bg-blue-50 text-gray-600 transition-colors">
                  {s}
                </button>
              ))}
              {mode === "help" && [
                "How do I add conditional fields?",
                "What field types are supported?",
                "How do wizard pages work?",
              ].map(s => (
                <button key={s} onClick={() => sendMessage(s)}
                  className="text-xs px-3 py-1.5 rounded-full border border-gray-200 hover:border-blue-400 hover:bg-blue-50 text-gray-600 transition-colors">
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="border-t border-gray-200 dark:border-gray-800 p-3">
            <div className="flex items-end gap-2 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 px-4 py-2 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  mode === "fill"   ? "Tell me your answer, or fill the form on the right…" :
                  mode === "create" ? "Describe the form you want to create…" :
                  "Ask anything about Form Engine…"
                }
                rows={1}
                className="flex-1 bg-transparent text-sm resize-none focus:outline-none leading-relaxed max-h-32 overflow-y-auto py-0.5"
                style={{ height: "auto" }}
                onInput={e => {
                  const el = e.target as HTMLTextAreaElement;
                  el.style.height = "auto";
                  el.style.height = Math.min(el.scrollHeight, 128) + "px";
                }}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || thinking}
                className="btn-primary py-1.5 px-3 text-sm flex-shrink-0 disabled:opacity-50">
                ↑
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1.5 text-center">
              Enter to send · Shift+Enter for new line
            </p>
          </div>
        </div>

        {/* Right panel: form display */}
        {showPanel && panelManifest && (
          <div className="hidden md:flex flex-col w-1/2 overflow-auto bg-gray-50 dark:bg-gray-950">
            <div className="sticky top-0 z-10 px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500">
                {mode === "fill" ? "Live Form" : "Preview"}
              </span>
              {Object.keys(panelManifest.forms ?? {}).map(fid => (
                <button key={fid} onClick={() => setPanelFid(fid)}
                  className={cn("px-2.5 py-1 rounded-lg text-xs font-medium",
                    panelFid === fid ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600")}>
                  {panelManifest.forms?.[fid]?.title ?? fid}
                </button>
              ))}
              {mode === "create" && panelManifest && (
                <button
                  onClick={async () => {
                    try {
                      const r = await api.upsertManifest(panelManifest as never);
                      toast.success(`Saved as "${r.manifest_id}"`);
                    } catch { toast.error("Save failed"); }
                  }}
                  className="ml-auto btn-primary text-xs py-1">
                  Save Form
                </button>
              )}
            </div>
            <div className="p-5">
              {panelFid && (
                <div className="bg-white dark:bg-gray-800/30 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
                  <div className="mb-5 pb-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="font-bold text-lg">{panelManifest.forms?.[panelFid]?.title}</h2>
                    {panelManifest.forms?.[panelFid]?.description && (
                      <p className="text-sm text-gray-500 mt-1">{panelManifest.forms[panelFid].description}</p>
                    )}
                  </div>
                  <FormEngine
                    key={`chat-${panelFid}-${JSON.stringify(answers).length}`}
                    manifest={panelManifest}
                    formId={panelFid}
                    initialAnswers={mode === "fill" ? answers : undefined}
                    onSubmit={async (payload: {}) => {
                      if (mode === "fill") {
                        toast.success("Form submitted via panel!");
                      }
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ChatMessage({ message }: { message: Message }) {
  const isUser = message.role === "user";

  // Render markdown-ish content
  const renderContent = (text: string) => {
    const parts = text.split(/(```[\s\S]*?```)/g);
    return parts.map((part, i) => {
      if (part.startsWith("```")) {
        const lang = part.match(/^```(\w*)/)?.[1] ?? "";
        const code = part.replace(/^```\w*\n?/, "").replace(/```$/, "");
        return (
          <pre key={i} className="bg-gray-900 text-green-300 rounded-lg p-3 text-xs font-mono overflow-x-auto my-2">
            <div className="text-gray-500 text-xs mb-1">{lang}</div>
            {code}
          </pre>
        );
      }
      // Simple bold/italic rendering
      const rendered = part
        .split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g)
        .map((chunk, j) => {
          if (chunk.startsWith("**") && chunk.endsWith("**"))
            return <strong key={j}>{chunk.slice(2, -2)}</strong>;
          if (chunk.startsWith("*") && chunk.endsWith("*"))
            return <em key={j}>{chunk.slice(1, -1)}</em>;
          if (chunk.startsWith("`") && chunk.endsWith("`"))
            return <code key={j} className="bg-gray-200 dark:bg-gray-700 px-1 rounded text-xs font-mono">{chunk.slice(1, -1)}</code>;
          return chunk;
        });
      return <span key={i}>{rendered}</span>;
    });
  };

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      {/* Avatar */}
      <div className={cn(
        "h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0",
        isUser
          ? "bg-gray-200 dark:bg-gray-700 text-gray-600"
          : "bg-gradient-to-br from-blue-500 to-indigo-600 text-white"
      )}>
        {isUser ? "You" : "⚡"}
      </div>

      {/* Bubble */}
      <div className={cn(
        "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
        isUser
          ? "bg-blue-600 text-white rounded-tr-sm"
          : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-tl-sm"
      )}>
        {renderContent(message.content)}
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">
      <span className="h-8 w-8 rounded-full border-2 border-gray-300 border-t-blue-500 animate-spin" />
    </div>}>
      <ChatPageInner />
    </Suspense>
  );
}
