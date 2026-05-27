"""
Pydantic v2 models for the Unified UI System Schema (ui_system.schema.yaml v1.0.0).

Merged from:
  form_schema_v4.yaml  — Form Engine Manifest
  ui_design.yaml       — UI Design Manifest
  design_additions.yaml — UI Design Patch

NOTE: No 'from __future__ import annotations' — forward refs handled
      explicitly with string literals and model_rebuild().
"""
from typing import Any, Dict, List, Literal, Optional, Union
from pydantic import BaseModel, Field, model_validator
from enum import Enum


# ═══════════════════════════════════════════════════════════════════════════════
# SCALAR ENUMS
# ═══════════════════════════════════════════════════════════════════════════════

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

# ── UI Layer enums ──────────────────────────────────────────────────────────────

class ComponentType(str, Enum):
    TREE = "Tree"
    TABLE = "Table"
    FORM = "Form"
    VERTICAL_LIST = "VerticalList"
    HORIZONTAL_LIST = "HorizontalList"
    SEARCH = "Search"
    CARD = "Card"
    TILE = "Tile"
    FILE_GALLERY = "FileGallery"
    FILTER_BUILDER = "FilterBuilder"
    AVATAR = "Avatar"
    CUSTOM = "Custom"

class LayoutDirection(str, Enum):
    CENTER = "Center"
    TOP = "Top"
    BOTTOM = "Bottom"
    LEFT = "Left"
    RIGHT = "Right"
    FLOATING = "Floating"
    MODAL = "Modal"

class ButtonType(str, Enum):
    FLAT = "Flat"
    BEVEL = "Bevel"
    SWIPE = "Swipe"
    HOVER = "Hover"

class ButtonActionType(str, Enum):
    CAPTCHA_CHECK_SUBMIT = "CaptchaCheckSubmit"
    SUBMIT = "Submit"
    CLEAR = "Clear"
    CANCEL = "Cancel"
    LOGOUT = "Logout"
    TOGGLE = "Toggle"
    CUSTOM = "Custom"

class ScreenAccessType(str, Enum):
    STACKED = "Stacked"
    DRAWER = "Drawer"
    POPUP_MENU_TOP = "PopupMenuTop"
    POPUP_MENU_BOTTOM = "PopupMenuBottom"

class UIPersistenceType(str, Enum):
    LRU = "LRU"
    SESSION = "Session"
    PROFILE = "Profile"
    APP_FIRST_LOAD = "AppFirstLoad"
    IN_APP = "InApp"

class ChoiceRenderType(str, Enum):
    RADIO = "radio"
    CHECKBOX = "checkbox"
    DROP_DOWN = "dropDown"
    AUTO_FILL = "autoFill"
    PICK = "pick"


# ═══════════════════════════════════════════════════════════════════════════════
# ENGINE CONFIG
# ═══════════════════════════════════════════════════════════════════════════════

class EngineConfig(BaseModel):
    mode: Literal["reactive", "static"] = "reactive"
    evaluation_order: Literal["dependency", "declaration"] = "dependency"
    error_mode: Literal["fail-fast", "collect-all"] = "collect-all"
    debounce_ms: int = Field(default=300, ge=0)


# ═══════════════════════════════════════════════════════════════════════════════
# TYPE SYSTEM
# ═══════════════════════════════════════════════════════════════════════════════

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


# ═══════════════════════════════════════════════════════════════════════════════
# DOMAIN MODELS
# ═══════════════════════════════════════════════════════════════════════════════

class ModelDef(BaseModel):
    description: Optional[str] = None
    inherits: Optional[List[str]] = None
    fields: Dict[str, Dict[str, Any]]


# ═══════════════════════════════════════════════════════════════════════════════
# CONDITIONS
# ═══════════════════════════════════════════════════════════════════════════════

class ConditionRef(BaseModel):
    ref: str

class SimpleCondition(BaseModel):
    field: str
    op: Literal[
        "eq", "neq", "in", "not_in", "gt", "gte", "lt", "lte",
        "contains", "starts_with", "ends_with",
        "is_empty", "is_not_empty", "is_true", "is_false"
    ]
    value: Optional[Any] = None

class ExpressionCondition(BaseModel):
    expression: str
    description: Optional[str] = None

class CompositeCondition(BaseModel):
    all: Optional[List["ConditionOrRef"]] = None  # type: ignore[assignment]
    any: Optional[List["ConditionOrRef"]] = None  # type: ignore[assignment]
    not_: Optional["ConditionOrRef"] = Field(default=None, alias="not")
    model_config = {"populate_by_name": True}

ConditionOrRef = Union[SimpleCondition, ExpressionCondition, CompositeCondition, ConditionRef]
CompositeCondition.model_rebuild()

class NamedCondition(BaseModel):
    description: Optional[str] = None
    expression: Optional[str] = None
    condition: Optional[ConditionOrRef] = None


# ═══════════════════════════════════════════════════════════════════════════════
# VALIDATION
# ═══════════════════════════════════════════════════════════════════════════════

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
    required_message: Optional[str] = None
    min_length: Optional[int] = None
    min_length_message: Optional[str] = None
    max_length: Optional[int] = None
    max_length_message: Optional[str] = None
    pattern: Optional[str] = None
    pattern_message: Optional[str] = None
    min: Optional[float] = None
    min_message: Optional[str] = None
    max: Optional[float] = None
    max_message: Optional[str] = None
    min_date: Optional[str] = None
    min_date_message: Optional[str] = None
    max_date: Optional[str] = None
    max_date_message: Optional[str] = None
    min_selected: Optional[int] = None
    max_selected: Optional[int] = None
    custom: Optional[str] = None
    custom_message: Optional[str] = None
    async_: Optional[str] = Field(default=None, alias="async")
    async_message: Optional[str] = None
    model_config = {"populate_by_name": True}

class NamedValidationRule(BaseModel):
    type: str
    description: Optional[str] = None
    value: Optional[Any] = None
    expression: Optional[str] = None
    message: Optional[str] = None
    handler: Optional[str] = None

class ValidationRegistry(BaseModel):
    rules: Optional[Dict[str, NamedValidationRule]] = None


# ═══════════════════════════════════════════════════════════════════════════════
# ACTIONS
# ═══════════════════════════════════════════════════════════════════════════════

class ActionDef(BaseModel):
    type: Literal[
        "set_field", "show_section", "hide_section", "navigate",
        "api_call", "emit_event", "show_toast", "show_dialog", "custom"
    ]
    description: Optional[str] = None
    params: Optional[List[str]] = None
    handler: Optional[str] = None
    toast_ref: Optional[str] = None   # when type=show_toast
    dialog_ref: Optional[str] = None  # when type=show_dialog

class ActionRef(BaseModel):
    action: Optional[str] = None
    ref: Optional[str] = None
    action_type: Optional[str] = None
    params: Optional[Dict[str, Any]] = None


# ═══════════════════════════════════════════════════════════════════════════════
# DATA SOURCES
# ═══════════════════════════════════════════════════════════════════════════════

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
    handler: Optional[str] = None


# ═══════════════════════════════════════════════════════════════════════════════
# TRACKING
# ═══════════════════════════════════════════════════════════════════════════════

class TrackingConfig(BaseModel):
    provider: Optional[str] = None
    events: Optional[Dict[str, Dict[str, Any]]] = None


# ═══════════════════════════════════════════════════════════════════════════════
# CHOICE SOURCES
# ═══════════════════════════════════════════════════════════════════════════════

class StaticChoice(BaseModel):
    value: Union[str, int, bool]
    label: str
    group: Optional[str] = None
    icon: Optional[str] = None
    disabled: bool = False

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

class StaticChoiceWrapper(BaseModel):
    static: List[StaticChoice]

class DynamicChoicesWrapper(BaseModel):
    dynamic: DynamicChoicesConfig

class SourceRefConfig(BaseModel):
    source_ref: str

ChoiceSource = Union[
    DynamicChoicesWrapper,
    SourceRefConfig,
    StaticChoiceWrapper,
    List[StaticChoice],
    DynamicChoicesConfig,
    str,
]


# ═══════════════════════════════════════════════════════════════════════════════
# SUBMIT ACTION
# ═══════════════════════════════════════════════════════════════════════════════

class SubmitAction(BaseModel):
    type: Literal["rest", "local", "none"]
    url: Optional[str] = None
    method: Optional[Literal["POST", "PUT", "PATCH"]] = "POST"
    headers: Optional[Dict[str, str]] = None
    transform_handler: Optional[str] = None
    handler_name: Optional[str] = None
    success_message: str = "Form submitted successfully!"
    error_message: str = "Submission failed. Please try again."


# ═══════════════════════════════════════════════════════════════════════════════
# FIELD BASE & TYPES
# ═══════════════════════════════════════════════════════════════════════════════

class ComputedField(BaseModel):
    expression: str
    type_hint: Optional[Literal["string", "number", "boolean", "date", "datetime"]] = None

class FormulaDefault(BaseModel):
    expression: str
    operator: Optional[str] = None
    values: Optional[List[str]] = None
    parameters: Optional[List[str]] = None

class FieldBase(BaseModel):
    id: str
    label: Optional[str] = None
    description: Optional[str] = None
    placeholder: Optional[str] = None
    hint: Optional[str] = None
    required: Optional[bool] = None
    required_if: Optional[str] = None
    disabled: Optional[bool] = None
    readonly: Optional[bool] = None
    editability: Optional[EditabilityType] = None
    default: Optional[Any] = None
    formula_default: Optional[FormulaDefault] = None
    computed: Optional[ComputedField] = None
    bind: Optional[str] = None
    condition: Optional[ConditionOrRef] = None
    clear_on_hide: bool = False
    branch: Optional[List[Dict[str, Any]]] = None
    on_change: Optional[ActionRef] = None
    validation: Optional[Validation] = None
    validate_on: Literal["blur", "change", "submit"] = "blur"
    width: Literal["full", "half", "third"] = "full"
    col_span: Optional[int] = Field(default=None, ge=1, le=12)
    widget: Optional[str] = None
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
    step_duration_s: Optional[int] = None
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

class ComplexField(FieldBase):
    type: Literal["complex"]
    complex_schema_id: str
    complex_schema_preview: bool = True
    cardinality: Literal["single", "list", "set", "map"]

class BoundField(FieldBase):
    bind: str

FormField = Union[
    TextField, MultilineField, RichTextField, BooleanField,
    NumberField, SelectField, MultiselectField, DateField,
    TimeField, DateTimeField, DateRangeField, FileField,
    RatingField, ColorField, JsonField, SignatureField,
    LocationField, HiddenField, ComplexField, BoundField,
]


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION, COLLECTION, PAGE
# ═══════════════════════════════════════════════════════════════════════════════

class CrossFieldValidation(BaseModel):
    fields: List[str]
    rule: str
    message: str

class FieldGroup(BaseModel):
    name: str
    description: Optional[str] = None
    applicable_on: List[str]
    group_type: GroupType
    message: Optional[str] = None
    index_type: Optional[Literal["NonUnique", "Unique", "Text"]] = None
    tags: Optional[Dict[str, str]] = None

class Collection(BaseModel):
    min_items: int = 0
    max_items: Optional[int] = None
    add_label: str = "Add Item"
    remove_label: str = "Remove"
    item_title_template: Optional[str] = None
    sortable: bool = False
    default_expanded: bool = True

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

class Branch(BaseModel):
    condition: Optional[ConditionOrRef] = None
    when: Optional[ConditionOrRef] = None
    goto: Optional[str] = None
    goTo: Optional[Dict[str, str]] = None
    description: Optional[str] = None

class Page(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    icon: Optional[str] = None
    condition: Optional[ConditionOrRef] = None
    on_enter: Optional[ActionRef] = None
    on_exit: Optional[ActionRef] = None
    sections: List[Section]


# ═══════════════════════════════════════════════════════════════════════════════
# UAM / FORM ACCESS
# ═══════════════════════════════════════════════════════════════════════════════

class FormAccess(BaseModel):
    feature_ref: Optional[str] = None
    allowed_role_categories: Optional[List[RoleCategory]] = None
    auth_context_key: str = "auth"
    submit_requires: Optional[Literal[
        "create", "update", "deactivate", "reactivate", "upload"
    ]] = None
    read_requires: Literal["read", "download", "print", "share"] = "read"

class ResolvedAuth(BaseModel):
    userId: Optional[str] = None
    schemaId: Optional[str] = None
    roleCategory: Optional[RoleCategory] = None
    roleNames: Optional[List[str]] = None
    features: Optional[List[str]] = None
    read: bool = False
    create: bool = False
    update: bool = False
    deactivate: bool = False
    reactivate: bool = False
    upload: bool = False
    download: bool = False
    print_: Optional[bool] = Field(default=False, alias="print")
    share: bool = False
    accessLevel: Optional[AccessLevel] = None
    fields: Optional[List[str]] = None
    filters: Optional[Dict[str, str]] = None
    model_config = {"populate_by_name": True}


# ═══════════════════════════════════════════════════════════════════════════════
# FORM DEFINITION
# ═══════════════════════════════════════════════════════════════════════════════

class FormLayout(BaseModel):
    type: Literal["single-page", "wizard", "grid"]
    columns: int = Field(default=12, ge=1, le=12)

class SubmitButtonConfig(BaseModel):
    label: Optional[str] = None
    position: Literal["bottom", "top", "both"] = "bottom"
    loading_label: Optional[str] = None
    icon: Optional[str] = None

class DraftConfig(BaseModel):
    persistence: Literal[
        "localStorage", "sessionStorage", "tauri-fs", "custom", "none"
    ] = "localStorage"
    auto_save: bool = False
    draft_key: Optional[str] = None

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
    submit_button: Optional[SubmitButtonConfig] = None  # legacy; prefer submit_label
    pages: Optional[List[Page]] = None
    sections: Optional[List[Section]] = None
    on_submit: Optional[SubmitAction] = None
    # When False, the client form engine suppresses its built-in success screen
    # (used by signin/signup forms that redirect on a successful server response).
    show_success_screen: Optional[bool] = None
    theme_ref: Optional[str] = None  # key from manifest "themes"


# ═══════════════════════════════════════════════════════════════════════════════
# UI LAYER — Icons, Breakpoints
# ═══════════════════════════════════════════════════════════════════════════════

class IconEntry(BaseModel):
    type: Literal["svg", "png", "lucide", "fontawesome", "custom"]
    path: Optional[str] = None
    name: Optional[str] = None
    component: Optional[str] = None
    alt: Optional[str] = None

class Breakpoint(BaseModel):
    min_width_px: int = Field(ge=0)
    max_width_px: Optional[int] = None
    label: Optional[str] = None
    columns: Optional[int] = Field(default=None, ge=1, le=24)


# ═══════════════════════════════════════════════════════════════════════════════
# UI LAYER — Navigation
# ═══════════════════════════════════════════════════════════════════════════════

class Route(BaseModel):
    screen: str
    path: Optional[str] = None
    params: Optional[Dict[str, str]] = None
    auth_required: bool = True
    feature_ref: Optional[str] = None

class NavigationConfig(BaseModel):
    initial_screen: Optional[str] = None
    type: Literal["tab_bar", "drawer", "stack", "none"] = "tab_bar"
    tab_bar_position: Literal["top", "bottom"] = "bottom"
    routes: Optional[Dict[str, Route]] = None
    guards: Optional[List[str]] = None


# ═══════════════════════════════════════════════════════════════════════════════
# UI LAYER — Feature
# ═══════════════════════════════════════════════════════════════════════════════

class Feature(BaseModel):
    name: str
    label: Optional[str] = None
    confidentiality: Optional[ConfidentialityType] = None
    components: Optional[List[str]] = None
    screens: Optional[List[str]] = None
    forms: Optional[List[str]] = None


# ═══════════════════════════════════════════════════════════════════════════════
# UI LAYER — Accessibility, Loading, Gestures, Transitions, Lifecycle
# ═══════════════════════════════════════════════════════════════════════════════

class AccessibilityProps(BaseModel):
    label: Optional[str] = None
    hint: Optional[str] = None
    role: Optional[Literal[
        "button", "link", "heading", "image", "list", "listitem",
        "checkbox", "radio", "switch", "slider", "tab", "tabpanel",
        "dialog", "alert", "status", "none"
    ]] = None
    live_region: Optional[Literal["off", "polite", "assertive"]] = None
    keyboard_shortcut: Optional[str] = None
    focus_order: Optional[int] = None
    min_touch_target_px: int = 44

class LoadingState(BaseModel):
    style: Literal[
        "spinner", "skeleton", "shimmer", "progress_bar", "overlay", "none"
    ] = "skeleton"
    skeleton_rows: int = Field(default=3, ge=1, le=20)
    overlay_opacity: float = Field(default=0.6, ge=0, le=1)
    min_display_ms: int = Field(default=400, ge=0)

class GestureHandler(BaseModel):
    gesture: Literal[
        "tap", "double_tap", "long_press",
        "swipe_left", "swipe_right", "swipe_up", "swipe_down",
        "pinch", "spread", "rotate"
    ]
    action_ref: str
    condition: Optional[ConditionOrRef] = None
    min_distance_px: Optional[int] = None
    long_press_duration_ms: int = 500

class Transition(BaseModel):
    type: Literal[
        "fade", "slide_left", "slide_right", "slide_up", "slide_down",
        "scale", "flip", "shared_element", "custom"
    ]
    duration_ms: int = 250
    easing: Optional[str] = None
    delay_ms: int = 0
    custom_handler: Optional[str] = None
    shared_element_tag: Optional[str] = None

class ComponentLifecycle(BaseModel):
    on_mount: Optional[str] = None
    on_unmount: Optional[str] = None
    on_focus: Optional[str] = None
    on_blur: Optional[str] = None
    on_data_load: Optional[str] = None
    on_data_error: Optional[str] = None
    on_refresh: Optional[str] = None


# ═══════════════════════════════════════════════════════════════════════════════
# UI LAYER — Button
# ═══════════════════════════════════════════════════════════════════════════════

class Button(BaseModel):
    name: str
    label: Optional[str] = None
    button_type: ButtonType = ButtonType.FLAT
    on_press: str
    custom_handler: Optional[str] = None
    icon_ref: Optional[str] = None
    icon_path: Optional[str] = None
    background_pic_path: Optional[str] = None
    text_size: Optional[Union[float, str]] = None
    foreground_color: Optional[str] = None
    background_color: Optional[str] = None
    disabled_condition: Optional[ConditionOrRef] = None
    hidden_condition: Optional[ConditionOrRef] = None
    accessibility: Optional[AccessibilityProps] = None
    confirm_dialog_ref: Optional[str] = None
    analytics_event: Optional[str] = None


# ═══════════════════════════════════════════════════════════════════════════════
# UI LAYER — Specialised Component Configs
# ═══════════════════════════════════════════════════════════════════════════════

class FileComponentConfig(BaseModel):
    allow_pictures: bool = True
    allow_files: bool = True
    allowed_file_types: Optional[List[str]] = None
    max_file_size_mb: float = 20
    upload_enabled: bool = False
    delete_enabled: bool = False
    download_enabled: bool = True
    thumbnail_size: Literal["small", "medium", "large"] = "medium"
    layout: Literal["grid", "list"] = "grid"
    category_filter: bool = False
    tag_filter: bool = False

class FilterBuilderConfig(BaseModel):
    filterable_fields: Optional[List[str]] = None
    allowed_operators: Optional[List[str]] = None
    max_conditions: int = 10
    allow_nesting: bool = False
    output_action_ref: Optional[str] = None
    preset_filters: Optional[List[Dict[str, str]]] = None

class AvatarConfig(BaseModel):
    show_photo: bool = True
    show_nick_name: bool = True
    fallback_style: Literal["initials", "icon", "placeholder"] = "initials"
    fallback_icon_ref: Optional[str] = None
    size: Literal["xs", "sm", "md", "lg", "xl"] = "md"
    shape: Literal["circle", "rounded", "square"] = "circle"
    show_online_indicator: bool = False


# ═══════════════════════════════════════════════════════════════════════════════
# UI LAYER — Data Binding
# ═══════════════════════════════════════════════════════════════════════════════

class DataBindingPagination(BaseModel):
    type: Literal["cursor", "page_number", "offset", "none"] = "none"
    page_size: int = 20
    page_param: str = "page"
    size_param: str = "per_page"

class DataBindingSort(BaseModel):
    field: Optional[str] = None
    direction: Literal["asc", "desc"] = "asc"

class DataBinding(BaseModel):
    source_ref: Optional[str] = None
    query_params: Optional[Dict[str, str]] = None
    write_action_ref: Optional[str] = None
    delete_action_ref: Optional[str] = None
    pagination: Optional[DataBindingPagination] = None
    sort: Optional[DataBindingSort] = None
    polling_interval_ms: Optional[int] = None
    optimistic_updates: bool = False


# ═══════════════════════════════════════════════════════════════════════════════
# UI LAYER — FormEmbedConfig
# ═══════════════════════════════════════════════════════════════════════════════

class FormEmbedConfig(BaseModel):
    mode: Literal["inline", "modal", "drawer", "panel"] = "inline"
    trigger_button_ref: Optional[str] = None
    pre_fill: Optional[Dict[str, str]] = None
    on_submit_action_ref: Optional[str] = None
    submit_label_override: Optional[str] = None


# ═══════════════════════════════════════════════════════════════════════════════
# UI LAYER — Sub-component Placement & Component
# ═══════════════════════════════════════════════════════════════════════════════

class SubComponentPlacement(BaseModel):
    component_ref: str
    direction: LayoutDirection
    breakpoint: Optional[str] = None
    hidden_condition: Optional[ConditionOrRef] = None

class Component(BaseModel):
    name: str
    label: Optional[str] = None
    type: ComponentType
    schema_ref: Optional[str] = None
    form_ref: Optional[str] = None
    form_embed: Optional[FormEmbedConfig] = None
    data_binding: Optional[DataBinding] = None
    text: Optional[str] = None
    text_size: Optional[Union[float, str]] = None
    foreground_color: Optional[str] = None
    background_color: Optional[str] = None
    background_pic_path: Optional[str] = None
    fields: Optional[List[str]] = None
    field_widget_overrides: Optional[Dict[str, str]] = None
    sections: Optional[List[str]] = None
    sub_components: Optional[List[SubComponentPlacement]] = None
    actions: Optional[List[Any]] = None
    ui_persistence: Optional[UIPersistenceType] = None
    choice_render: Optional[ChoiceRenderType] = None
    file_config: Optional[FileComponentConfig] = None
    filter_config: Optional[FilterBuilderConfig] = None
    avatar_config: Optional[AvatarConfig] = None
    show_pro_fields: bool = False
    enable_branching: bool = True
    sectioned: bool = False
    field_validation_hints: bool = True
    breakpoint_overrides: Optional[Dict[str, Any]] = None
    feature_ref: Optional[str] = None
    hidden_condition: Optional[ConditionOrRef] = None
    visible_access_levels: Optional[List[AccessLevel]] = None
    theme_ref: Optional[str] = None
    lifecycle: Optional[ComponentLifecycle] = None
    loading_state: Optional[LoadingState] = None
    empty_state: Optional[Dict[str, Any]] = None
    error_state: Optional[Dict[str, Any]] = None
    gestures: Optional[List[GestureHandler]] = None
    accessibility: Optional[AccessibilityProps] = None
    transition_in: Optional[str] = None
    transition_out: Optional[str] = None
    analytics_id: Optional[str] = None


# ═══════════════════════════════════════════════════════════════════════════════
# UI LAYER — Screen
# ═══════════════════════════════════════════════════════════════════════════════

class ScreenAuthRules(BaseModel):
    require_auth: bool = True
    require_access_levels: Optional[List[AccessLevel]] = None
    require_permissions: Optional[List[str]] = None
    redirect_on_denied: Optional[str] = None
    denied_toast_ref: Optional[str] = None

class SecondaryScreenLink(BaseModel):
    screen_ref: str
    access_type: ScreenAccessType
    menu_label: Optional[str] = None
    menu_order: Optional[int] = None
    hidden_condition: Optional[ConditionOrRef] = None
    params: Optional[Dict[str, str]] = None

class Screen(BaseModel):
    name: str
    label: Optional[str] = None
    icon_ref: Optional[str] = None
    icon_path: Optional[str] = None
    is_home: bool = False
    nav_order: Optional[int] = None
    components: Optional[List[SubComponentPlacement]] = None
    secondary_screens: Optional[List[SecondaryScreenLink]] = None
    feature_ref: Optional[str] = None
    allowed_role_categories: Optional[List[RoleCategory]] = None
    auth_rules: Optional[ScreenAuthRules] = None
    background_color: Optional[str] = None
    background_pic_path: Optional[str] = None
    theme_ref: Optional[str] = None
    on_enter: Optional[str] = None
    on_exit: Optional[str] = None
    on_back: Optional[str] = None
    transition_in: Optional[str] = None
    transition_out: Optional[str] = None
    status_bar: Optional[Dict[str, Any]] = None
    analytics_id: Optional[str] = None


# ═══════════════════════════════════════════════════════════════════════════════
# UI LAYER — Toast, Dialog
# ═══════════════════════════════════════════════════════════════════════════════

class Toast(BaseModel):
    message: str
    severity: Literal["info", "success", "warning", "error"] = "info"
    duration_ms: int = 3000
    position: Literal[
        "top", "top_left", "top_right",
        "bottom", "bottom_left", "bottom_right"
    ] = "bottom"
    action_label: Optional[str] = None
    action_ref: Optional[str] = None
    icon_ref: Optional[str] = None

class Dialog(BaseModel):
    title: str
    body: Optional[str] = None
    icon_ref: Optional[str] = None
    severity: Literal["info", "success", "warning", "error", "neutral"] = "neutral"
    dismissible: bool = True
    primary_action: Optional[Button] = None
    secondary_action: Optional[Button] = None
    component_ref: Optional[str] = None
    max_width_px: int = 480


# ═══════════════════════════════════════════════════════════════════════════════
# DESIGN ADDITIONS — WidgetMap & RolePreferenceOverride
# ═══════════════════════════════════════════════════════════════════════════════

class WidgetMap(BaseModel):
    enum: str = "EnumFormField"
    choice: str = "ChoiceFormField"
    string: str = "TextFormField"
    multiLineText: str = "MultiLineTextFormField"
    number: str = "NumberFormField"
    boolean: str = "TristateCheckboxFormField"
    date: str = "DatePickerFormField"
    any: str = "AnyFormField"
    id: str = "TextFormField"
    secret: str = "PasswordFormField"
    reference: str = "SearchPickerFormField"

class RolePreferenceOverride(BaseModel):
    theme_extends: Optional[str] = None
    default_locale: Optional[str] = None
    default_currency: Optional[str] = None
    hidden_screens: Optional[List[str]] = None
    hidden_components: Optional[List[str]] = None
    column_visibility: Optional[Dict[str, List[str]]] = None
    show_pro_fields: Optional[bool] = None
    items_per_page: Optional[int] = None
    date_format: Optional[str] = None
    active_features: Optional[List[str]] = None


# ═══════════════════════════════════════════════════════════════════════════════
# THEMES
# ═══════════════════════════════════════════════════════════════════════════════

class ThemeTypography(BaseModel):
    font_family_default: Optional[str] = None
    font_family_mono: Optional[str] = None
    scale: Optional[Dict[str, Union[str, float]]] = None

class ThemeMotion(BaseModel):
    duration_fast_ms: int = 100
    duration_standard_ms: int = 250
    duration_slow_ms: int = 400
    easing_standard: str = "cubic-bezier(0.4, 0, 0.2, 1)"
    easing_decelerate: str = "cubic-bezier(0, 0, 0.2, 1)"
    easing_accelerate: str = "cubic-bezier(0.4, 0, 1, 1)"
    reduced_motion: bool = False

class ThemeDefinition(BaseModel):
    label: Optional[str] = None
    extends: Optional[str] = None
    colors: Optional[Dict[str, str]] = None
    typography: Optional[ThemeTypography] = None
    spacing: Optional[Dict[str, Union[str, float]]] = None
    radius: Optional[Dict[str, Union[str, float]]] = None
    elevation: Optional[Dict[str, str]] = None
    motion: Optional[ThemeMotion] = None
    dark_mode: Optional[Dict[str, str]] = None
    selectable: bool = True
    preview_color: Optional[str] = None


# ═══════════════════════════════════════════════════════════════════════════════
# TEMPLATES
# ═══════════════════════════════════════════════════════════════════════════════

class TemplateVariable(BaseModel):
    name: str
    type: Literal[
        "string", "boolean", "number", "screen_ref", "component_ref",
        "form_ref", "schema_ref", "feature_ref", "icon_ref",
        "data_source_ref", "action_ref"
    ]
    required: bool = True
    default: Optional[Any] = None
    description: Optional[str] = None

class ScreenTemplate(BaseModel):
    label: Optional[str] = None
    description: Optional[str] = None
    variables: List[TemplateVariable]
    screen: Screen
    tags: Optional[Dict[str, str]] = None

class ComponentTemplate(BaseModel):
    label: Optional[str] = None
    description: Optional[str] = None
    variables: List[TemplateVariable]
    component: Component
    tags: Optional[Dict[str, str]] = None

class FormTemplate(BaseModel):
    label: Optional[str] = None
    description: Optional[str] = None
    variables: List[TemplateVariable]
    form: FormDef
    tags: Optional[Dict[str, str]] = None

class TemplateRegistry(BaseModel):
    screen_templates: Optional[Dict[str, ScreenTemplate]] = None
    component_templates: Optional[Dict[str, ComponentTemplate]] = None
    form_templates: Optional[Dict[str, FormTemplate]] = None


# ═══════════════════════════════════════════════════════════════════════════════
# LEGACY UI CONFIG (for backward compat with old manifests)
# ═══════════════════════════════════════════════════════════════════════════════

class UIConfig(BaseModel):
    theme: Optional[str] = None
    locale: Optional[str] = None
    date_locale: Optional[str] = None
    show_progress: Optional[bool] = None
    show_section_numbers: Optional[bool] = None
    groups: Optional[List[FieldGroup]] = None


# ═══════════════════════════════════════════════════════════════════════════════
# TOP-LEVEL MANIFEST  (UISystemManifest — ui_system.schema.yaml v1.0.0)
# ═══════════════════════════════════════════════════════════════════════════════

class UISystemManifest(BaseModel):
    """
    Top-level manifest for the complete UI system.
    Conforms to ui_system.schema.yaml v1.0.0 (unified form + UI layer).
    """
    manifest_id: Optional[str] = None
    manifest_version: str = "1.0.0"
    description: Optional[str] = None
    namespaces: Optional[List[str]] = None

    # ── Form Engine ────────────────────────────────────────────────────────────
    engine: Optional[EngineConfig] = None
    types: Optional[TypeSystem] = None
    models: Optional[Dict[str, ModelDef]] = None
    conditions: Optional[Dict[str, NamedCondition]] = None
    validation: Optional[ValidationRegistry] = None
    actions: Optional[Dict[str, ActionDef]] = None
    data_sources: Optional[Dict[str, DataSourceDef]] = None
    i18n: Optional[Dict[str, Dict[str, str]]] = None
    tracking: Optional[TrackingConfig] = None
    forms: Optional[Dict[str, FormDef]] = None

    # ── UI Layer ───────────────────────────────────────────────────────────────
    icons: Optional[Dict[str, IconEntry]] = None
    breakpoints: Optional[Dict[str, Breakpoint]] = None
    navigation: Optional[NavigationConfig] = None
    features: Optional[Dict[str, Feature]] = None
    buttons: Optional[Dict[str, Button]] = None
    components: Optional[Dict[str, Component]] = None
    screens: Optional[Dict[str, Screen]] = None
    toasts: Optional[Dict[str, Toast]] = None
    dialogs: Optional[Dict[str, Dialog]] = None
    transitions: Optional[Dict[str, Transition]] = None

    # ── Design Additions ───────────────────────────────────────────────────────
    widget_map: Optional[WidgetMap] = None
    role_preferences: Optional[Dict[str, RolePreferenceOverride]] = None

    # ── Themes ─────────────────────────────────────────────────────────────────
    themes: Optional[Dict[str, ThemeDefinition]] = None
    active_theme: str = "default"

    # ── Templates ──────────────────────────────────────────────────────────────
    templates: Optional[TemplateRegistry] = None

    # ── Legacy compat ──────────────────────────────────────────────────────────
    ui: Optional[UIConfig] = None


# Backward-compatibility alias (all existing code using FormManifest still works)
FormManifest = UISystemManifest


# ═══════════════════════════════════════════════════════════════════════════════
# API MODELS
# ═══════════════════════════════════════════════════════════════════════════════

class CreateFormRequest(BaseModel):
    form_id: str
    manifest: UISystemManifest

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
