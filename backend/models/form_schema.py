"""
Pydantic v2 models for the Form Engine Manifest (form_schema_v5.yaml).
NOTE: No 'from __future__ import annotations' — forward refs are handled
      explicitly with string literals and model_rebuild().
"""
from typing import Any, Dict, List, Literal, Optional, Union
from pydantic import BaseModel, Field, model_validator
from enum import Enum


# ─── Scalar Enums ─────────────────────────────────────────────────────────────

class ConfidentialityType(str, Enum):
    PUBLIC = "Public"
    INTERNAL = "Internal"
    CONFIDENTIAL = "Confidential"
    RESTRICTED = "Restricted"
    SECRET = "Secret"

class EditabilityType(str, Enum):
    MUTABLE = "Mutable"
    MUTABLE_IF_NULL = "MutableIfNull"
    IMMUTABLE = "Immutable"
    GENERATED = "Generated"

class NumberType(str, Enum):
    INT = "int"
    LONG = "long"
    FLOAT = "float"
    DOUBLE = "double"
    DECIMAL2 = "decimal2"
    DECIMAL4 = "decimal4"
    DECIMAL6 = "decimal6"
    NPS = "NPS"

class FormState(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    DEPRECATED = "deprecated"
    ARCHIVED = "archived"

class GroupType(str, Enum):
    ONE_OF = "OneOf"
    ANY_OF = "AnyOf"
    ALL_OF = "AllOf"
    INDEX = "Index"

class RenderMode(str, Enum):
    INLINE = "inline"
    MODAL = "modal"
    PANEL = "panel"

class AccessLevel(str, Enum):
    SELF = "Self"
    DELEGATED = "Delegated"
    TEAM = "Team"
    REPORTEE = "Reportee"
    CATEGORY = "Category"

class RoleCategory(str, Enum):
    CUSTOMER = "Customer"
    EMPLOYEE = "Employee"
    PARTNER = "Partner"
    CONTRACTOR = "Contractor"
    AUTOMATON = "Automaton"


# ─── Engine Config ─────────────────────────────────────────────────────────────

class EngineConfig(BaseModel):
    mode: Literal["reactive", "static"] = "reactive"
    evaluation_order: Literal["dependency", "declaration"] = "dependency"
    error_mode: Literal["fail-fast", "collect-all"] = "collect-all"
    debounce_ms: int = Field(default=300, ge=0)


# ─── Type System ───────────────────────────────────────────────────────────────

class AliasTypeDef(BaseModel):
    type: str
    description: Optional[str] = None
    validation: Optional[List[Dict[str, Any]]] = None

class ObjectTypeDef(BaseModel):
    description: Optional[str] = None
    fields: Dict[str, Dict[str, Any]]

class TypeSystem(BaseModel):
    primitives: Optional[Dict[str, Any]] = None
    enums: Optional[Dict[str, Dict[str, Any]]] = None
    objects: Optional[Dict[str, ObjectTypeDef]] = None
    aliases: Optional[Dict[str, AliasTypeDef]] = None


# ─── Models ────────────────────────────────────────────────────────────────────

class ModelDef(BaseModel):
    description: Optional[str] = None
    inherits: Optional[List[str]] = None
    fields: Dict[str, Dict[str, Any]]


# ─── Conditions ────────────────────────────────────────────────────────────────

class ConditionRef(BaseModel):
    ref: str

class SimpleCondition(BaseModel):
    field: str
    op: Literal[
        "eq", "neq", "in", "not_in", "gt", "gte", "lt", "lte",
        "contains", "starts_with", "is_empty", "is_not_empty",
        "is_true", "is_false"
    ]
    value: Optional[Any] = None

class ExpressionCondition(BaseModel):
    expression: str
    description: Optional[str] = None

# CompositeCondition is self-referential; use string forward refs for its own fields.
class CompositeCondition(BaseModel):
    all: Optional[List["ConditionOrRef"]] = None  # type: ignore[assignment]
    any: Optional[List["ConditionOrRef"]] = None  # type: ignore[assignment]
    not_: Optional["ConditionOrRef"] = Field(default=None, alias="not")

    model_config = {"populate_by_name": True}

# ConditionOrRef defined after CompositeCondition so no forward ref needed here.
ConditionOrRef = Union[SimpleCondition, ExpressionCondition, CompositeCondition, ConditionRef]

# Resolve the forward refs inside CompositeCondition now that ConditionOrRef exists.
CompositeCondition.model_rebuild()

class NamedCondition(BaseModel):
    description: Optional[str] = None
    expression: Optional[str] = None
    condition: Optional[ConditionOrRef] = None


# ─── Validation ────────────────────────────────────────────────────────────────

class ValidationRule(BaseModel):
    type: Literal[
        "required", "regex", "min", "max", "min_length", "max_length",
        "min_date", "max_date", "min_selected", "max_selected",
        "expression", "custom", "async"
    ]
    value: Optional[Any] = None
    expression: Optional[str] = None
    message: Optional[str] = None
    handler: Optional[str] = None
    rule_ref: Optional[str] = None

class Validation(BaseModel):
    rules: Optional[List[ValidationRule]] = None
    rule_ref: Optional[str] = None

class NamedValidationRule(BaseModel):
    type: str
    description: Optional[str] = None
    value: Optional[Any] = None
    expression: Optional[str] = None
    message: Optional[str] = None
    handler: Optional[str] = None

class ValidationRegistry(BaseModel):
    rules: Optional[Dict[str, NamedValidationRule]] = None


# ─── Actions ───────────────────────────────────────────────────────────────────

class ActionDef(BaseModel):
    type: Literal["set_field", "show_section", "hide_section", "navigate",
                  "api_call", "emit_event", "custom"]
    description: Optional[str] = None
    params: Optional[List[str]] = None
    handler: Optional[str] = None

class ActionRef(BaseModel):
    action: str
    params: Optional[Dict[str, Any]] = None


# ─── Data Sources ──────────────────────────────────────────────────────────────

class DataSourceDef(BaseModel):
    type: Literal["rest", "local", "graphql"]
    description: Optional[str] = None
    endpoint: Optional[str] = None
    method: Literal["GET", "POST"] = "GET"
    headers: Optional[Dict[str, str]] = None
    query_params: Optional[Dict[str, str]] = None
    body_template: Optional[str] = None
    response_path: Optional[str] = None
    value_key: Optional[str] = None
    label_key: Optional[str] = None
    group_key: Optional[str] = None
    search_param: Optional[str] = None
    depends_on: Optional[str] = None
    cache_ttl_seconds: int = 300

class DynamicChoicesConfig(BaseModel):
    url: str
    method: Literal["GET", "POST"] = "GET"
    headers: Optional[Dict[str, str]] = None
    query_params: Optional[Dict[str, str]] = None
    body_template: Optional[str] = None
    response_path: str = ""
    value_key: str
    label_key: str
    group_key: Optional[str] = None
    search_param: Optional[str] = None
    depends_on: Optional[str] = None
    cache_ttl_seconds: int = 300
    option_filter: Optional[Dict[str, str]] = None

class StaticChoice(BaseModel):
    value: Union[str, int, bool]
    label: str
    group: Optional[str] = None
    icon: Optional[str] = None
    disabled: bool = False

class StaticChoiceWrapper(BaseModel):
    """Handles: choices: { static: [...] }"""
    static: List[StaticChoice]

class DynamicChoicesWrapper(BaseModel):
    """Handles: choices: { dynamic: { url, value_key, label_key, ... } }
    This is the schema-conformant form (ChoiceSource.dynamic branch)."""
    dynamic: DynamicChoicesConfig

class SourceRefConfig(BaseModel):
    """Handles: choices: { source_ref: 'data_source_name' }"""
    source_ref: str

# ChoiceSource accepts all forms the schema allows:
#   { dynamic: {...} }  — schema-conformant dynamic wrapper  (most specific, check first)
#   { source_ref: "x" } — named manifest data source ref
#   { static: [...] }   — explicit static wrapper
#   [...]               — bare list (legacy / most common in sample forms)
#   DynamicChoicesConfig — inline flat form (kept for backward compat)
#   str                 — plain string alias (rarely used)
# NOTE: DynamicChoicesWrapper must appear before DynamicChoicesConfig in the union
# so Pydantic matches { dynamic: {...} } as a wrapper, not as a flat config dict.
ChoiceSource = Union[
    DynamicChoicesWrapper,
    SourceRefConfig,
    StaticChoiceWrapper,
    List[StaticChoice],
    DynamicChoicesConfig,
    str,
]


# ─── Submit Action ─────────────────────────────────────────────────────────────

class SubmitAction(BaseModel):
    type: Literal["rest", "local", "none"]
    url: Optional[str] = None
    method: Optional[Literal["POST", "PUT", "PATCH"]] = "POST"
    headers: Optional[Dict[str, str]] = None
    transform_handler: Optional[str] = None
    handler_name: Optional[str] = None
    success_message: str = "Form submitted successfully!"
    error_message: str = "Submission failed. Please try again."


# ─── Field Base ────────────────────────────────────────────────────────────────

class FieldBase(BaseModel):
    id: str
    label: Optional[str] = None
    description: Optional[str] = None
    placeholder: Optional[str] = None
    hint: Optional[str] = None
    required: Optional[bool] = None
    disabled: Optional[bool] = None
    readonly: Optional[bool] = None
    default: Optional[Any] = None
    computed: Optional[Dict[str, Any]] = None
    bind: Optional[str] = None
    condition: Optional[ConditionOrRef] = None
    on_change: Optional[ActionRef] = None
    branches: Optional[List[Dict[str, Any]]] = None
    validation: Optional[Validation] = None
    validate_on: Literal["blur", "change", "submit"] = "blur"
    width: Literal["full", "half", "third"] = "full"
    col_span: Optional[int] = Field(default=None, ge=1, le=12)
    confidentiality: Optional[ConfidentialityType] = None
    personal_data: bool = False
    purpose: Optional[str] = None
    retention_days: Optional[int] = None
    system_generated: bool = False
    summary_field: bool = False
    key_field: bool = False
    advanced: bool = False
    ui_only: bool = False
    one_of_group: Optional[str] = None
    permission_ref: Optional[str] = None
    visible_access_levels: Optional[List[AccessLevel]] = None
    tags: Optional[Dict[str, str]] = None
    editability: Optional[EditabilityType] = None


# ─── Field Types ───────────────────────────────────────────────────────────────

class TextField(FieldBase):
    type: Literal["text"]
    min_length: Optional[int] = None
    max_length: Optional[int] = None
    pattern: Optional[str] = None
    pattern_message: Optional[str] = None
    autocomplete: Optional[str] = None

class MultilineField(FieldBase):
    type: Literal["multiline"]
    rows: int = Field(default=4, ge=2, le=30)
    max_length: Optional[int] = None
    resize: Literal["none", "vertical", "both"] = "vertical"

class RichTextField(FieldBase):
    type: Literal["richtext"]
    toolbar: Optional[List[str]] = None
    max_length: Optional[int] = None

class BooleanField(FieldBase):
    type: Literal["boolean"]
    display_as: Literal["switch", "checkbox", "yes-no-radio"] = "switch"
    true_label: str = "Yes"
    false_label: str = "No"

class NumberField(FieldBase):
    type: Literal["number"]
    number_type: Optional[NumberType] = None
    signed: bool = True
    multiple_of: Optional[float] = None
    display_as: Literal["input", "slider", "stepper"] = "input"
    min: Optional[float] = None
    max: Optional[float] = None
    step: float = 1
    decimal_places: int = Field(default=0, ge=0, le=10)
    prefix: Optional[str] = None
    suffix: Optional[str] = None

class SelectField(FieldBase):
    type: Literal["select"]
    choices: ChoiceSource
    display_as: Literal["auto", "radio", "dropdown", "button-group"] = "auto"
    allow_others: bool = False
    others_type: Literal["text", "number"] = "text"
    option_filter: Optional[Dict[str, str]] = None

class MultiselectField(FieldBase):
    type: Literal["multiselect"]
    choices: ChoiceSource
    display_as: Literal["auto", "checkbox", "dropdown", "tag-input"] = "auto"
    min_selected: int = 0
    max_selected: Optional[int] = None
    allow_others: bool = False
    others_type: Literal["text", "number"] = "text"
    option_filter: Optional[Dict[str, str]] = None

class DateField(FieldBase):
    type: Literal["date"]
    use_current: bool = False
    min_date: Optional[str] = None
    max_date: Optional[str] = None
    disable_weekends: bool = False
    disable_dates: Optional[List[str]] = None
    date_format: str = "dd/MM/yyyy"

class TimeField(FieldBase):
    type: Literal["time"]
    min_time: Optional[str] = None
    max_time: Optional[str] = None
    step_minutes: int = Field(default=15, ge=1, le=60)
    use_24h: bool = False

class DateTimeField(FieldBase):
    type: Literal["datetime"]
    use_current: bool = False
    min_date: Optional[str] = None
    max_date: Optional[str] = None
    disable_weekends: bool = False
    disable_dates: Optional[List[str]] = None
    date_format: str = "dd/MM/yyyy"
    min_time: Optional[str] = None
    max_time: Optional[str] = None
    step_minutes: int = Field(default=15, ge=1, le=60)
    use_24h: bool = False

class DateRangeField(FieldBase):
    type: Literal["daterange"]
    min_date: Optional[str] = None
    max_date: Optional[str] = None
    disable_weekends: bool = False
    disable_dates: Optional[List[str]] = None
    date_format: str = "dd/MM/yyyy"
    min_range_days: Optional[int] = None
    max_range_days: Optional[int] = None

class FileField(FieldBase):
    type: Literal["file"]
    accept: Optional[str] = None
    max_size_mb: float = 10
    max_files: int = 1
    storage: Literal["memory", "base64", "tauri-fs"] = "memory"

class RatingField(FieldBase):
    type: Literal["rating"]
    max: int = Field(default=5, ge=2, le=10)
    display_as: Literal["stars", "numeric-scale", "emoji-scale"] = "stars"
    low_label: str = "Poor"
    high_label: str = "Excellent"

class ColorField(FieldBase):
    type: Literal["color"]
    format: Literal["hex", "rgba", "hsl"] = "hex"
    presets: Optional[List[str]] = None

class JsonField(FieldBase):
    type: Literal["json"]
    schema_: Optional[Dict[str, Any]] = Field(default=None, alias="schema")
    rows: int = Field(default=8, ge=2, le=40)

class SignatureField(FieldBase):
    type: Literal["signature"]
    canvas_width: int = Field(default=600, ge=200, le=1200)
    canvas_height: int = Field(default=160, ge=60, le=400)
    stroke_color: Optional[str] = None

class LocationField(FieldBase):
    type: Literal["location"]
    mode: Literal["coordinates", "address-search", "map-pin"] = "address-search"
    geocoding_source: Optional[str] = None

class HiddenField(FieldBase):
    type: Literal["hidden"]
    value_from: Literal["default", "context", "query-param", "computed"]
    context_key: Optional[str] = None
    query_param: Optional[str] = None

class BoundField(FieldBase):
    bind: str

# Discriminated union — order matters: more specific types first.
FormField = Union[
    TextField, MultilineField, RichTextField, BooleanField,
    NumberField, SelectField, MultiselectField, DateField,
    TimeField, DateTimeField, DateRangeField, FileField,
    RatingField, ColorField, JsonField, SignatureField,
    LocationField, HiddenField, BoundField,
]


# ─── Cross-Field & Groups ─────────────────────────────────────────────────────

class CrossFieldValidation(BaseModel):
    fields: List[str]   # min 2 items — validated at schema level, not Pydantic
    rule: str
    message: str

class FieldGroup(BaseModel):
    name: str
    description: Optional[str] = None
    applicable_on: List[str]   # min 2 items — validated at schema level
    group_type: GroupType
    message: Optional[str] = None
    index_type: Optional[Literal["NonUnique", "Unique", "Text"]] = None
    tags: Optional[Dict[str, str]] = None


# ─── Collection ────────────────────────────────────────────────────────────────

class Collection(BaseModel):
    min_items: int = 0
    max_items: Optional[int] = None
    add_label: str = "Add Item"
    remove_label: str = "Remove"
    item_title_template: Optional[str] = None
    sortable: bool = False
    default_expanded: bool = True


# ─── Section ───────────────────────────────────────────────────────────────────

class Section(BaseModel):
    id: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    condition: Optional[ConditionOrRef] = None
    bind_prefix: Optional[str] = None
    component: Optional[str] = None
    collection: Optional[Collection] = None
    fields: Optional[List[FormField]] = None
    cross_field_validations: Optional[List[CrossFieldValidation]] = None
    groups: Optional[List[FieldGroup]] = None


# ─── Branch ────────────────────────────────────────────────────────────────────

class Branch(BaseModel):
    condition: ConditionOrRef
    goto: str
    description: Optional[str] = None


# ─── Page ──────────────────────────────────────────────────────────────────────

class Page(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    icon: Optional[str] = None
    condition: Optional[ConditionOrRef] = None
    on_enter: Optional[ActionRef] = None
    on_exit: Optional[ActionRef] = None
    sections: List[Section]   # min 1 — not enforced by Pydantic to avoid forward-ref issues


# ─── Form Access (UAM) ─────────────────────────────────────────────────────────

class FormAccess(BaseModel):
    feature_ref: Optional[str] = None
    allowed_role_categories: Optional[List[RoleCategory]] = None
    auth_context_key: str = "auth"
    submit_requires: Optional[Literal["create", "update", "deactivate",
                                       "reactivate", "upload"]] = None
    read_requires: Literal["read", "download", "print", "share"] = "read"


# ─── Draft Config ──────────────────────────────────────────────────────────────

class DraftConfig(BaseModel):
    persistence: Literal["localStorage", "sessionStorage", "tauri-fs",
                          "custom", "none"] = "localStorage"
    auto_save: bool = False
    draft_key: Optional[str] = None


# ─── Form ──────────────────────────────────────────────────────────────────────

class FormLayout(BaseModel):
    type: Literal["single-page", "wizard", "grid"]
    columns: int = Field(default=12, ge=1, le=12)

class FormDef(BaseModel):
    title: str
    description: Optional[str] = None
    version: str
    form_state: FormState = FormState.ACTIVE
    tags: Optional[Dict[str, str]] = None
    confidentiality: ConfidentialityType = ConfidentialityType.INTERNAL
    retention_days: Optional[int] = None
    access: Optional[FormAccess] = None
    model: Optional[str] = None
    state: Optional[DraftConfig] = None
    layout: FormLayout
    submit_label: str = "Submit"
    draft_label: str = "Save Draft"
    pages: Optional[List[Page]] = None
    sections: Optional[List[Section]] = None
    on_submit: Optional[SubmitAction] = None


# ─── UI Config ─────────────────────────────────────────────────────────────────

class UIConfig(BaseModel):
    theme: Optional[str] = None
    locale: Optional[str] = None
    date_locale: Optional[str] = None
    show_progress: Optional[bool] = None
    show_section_numbers: Optional[bool] = None
    groups: Optional[List[FieldGroup]] = None


# ─── Tracking ──────────────────────────────────────────────────────────────────

class TrackingConfig(BaseModel):
    provider: Optional[str] = None
    events: Optional[Dict[str, Dict[str, Any]]] = None


# ─── Top-level Manifest ────────────────────────────────────────────────────────

class FormManifest(BaseModel):
    manifest_id: Optional[str] = None
    manifest_version: str = "4.0.0"
    engine: Optional[EngineConfig] = None
    namespaces: Optional[List[str]] = None
    conditions: Optional[Dict[str, NamedCondition]] = None
    validation: Optional[ValidationRegistry] = None
    actions: Optional[Dict[str, ActionDef]] = None
    data_sources: Optional[Dict[str, DataSourceDef]] = None
    ui: Optional[UIConfig] = None
    components: Optional[Dict[str, Section]] = None
    i18n: Optional[Dict[str, Dict[str, str]]] = None
    tracking: Optional[TrackingConfig] = None
    forms: Optional[Dict[str, FormDef]] = None


# ─── API Models ────────────────────────────────────────────────────────────────

class CreateFormRequest(BaseModel):
    form_id: str
    manifest: FormManifest

class FormSubmission(BaseModel):
    form_id: str
    manifest_id: Optional[str] = None
    answers: Dict[str, Any]
    draft: bool = False
    context: Optional[Dict[str, Any]] = None

class FormSubmissionResponse(BaseModel):
    submission_id: str
    form_id: str
    status: Literal["accepted", "draft_saved", "rejected"]
    errors: Optional[Dict[str, List[str]]] = None
    message: Optional[str] = None
