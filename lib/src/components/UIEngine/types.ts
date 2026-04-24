/**
 * UIEngine Type Definitions
 * Aligned with ui_design.yaml schema
 */

// ─────────────────────────────────────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────────────────────────────────────

export enum ComponentType {
  Tree = 'Tree',
  Table = 'Table',
  Form = 'Form',
  VerticalList = 'VerticalList',
  HorizontalList = 'HorizontalList',
  Search = 'Search',
  Card = 'Card',
  Tile = 'Tile',
}

export enum LayoutDirection {
  Center = 'Center',
  Top = 'Top',
  Bottom = 'Bottom',
  Left = 'Left',
  Right = 'Right',
  Floating = 'Floating',
  Modal = 'Modal',
}

export enum ButtonType {
  Flat = 'Flat',
  Bevel = 'Bevel',
  Swipe = 'Swipe',
  Hover = 'Hover',
}

export enum ButtonActionType {
  CaptchaCheckSubmit = 'CaptchaCheckSubmit',
  Submit = 'Submit',
  Clear = 'Clear',
  Cancel = 'Cancel',
  Logout = 'Logout',
  Toggle = 'Toggle',
  Custom = 'Custom',
}

export enum ScreenAccessType {
  Stacked = 'Stacked',
  Drawer = 'Drawer',
  PopupMenuTop = 'PopupMenuTop',
  PopupMenuBottom = 'PopupMenuBottom',
}

export enum IconType {
  SVG = 'svg',
  PNG = 'png',
  Lucide = 'lucide',
  FontAwesome = 'fontawesome',
  Custom = 'custom',
}

export enum ButtonStyle {
  Flat = 'flat',
  Outlined = 'outlined',
  Contained = 'contained',
  Text = 'text',
}

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS & THEME
// ─────────────────────────────────────────────────────────────────────────────

export interface DesignTokens {
  colors: Record<string, string>;
  typography: {
    font_family_default?: string;
    font_family_mono?: string;
    scale: Record<string, string | number>;
  };
  spacing: Record<string, string | number>;
  radius: Record<string, string | number>;
  elevation: Record<string, string>;
  motion: {
    duration_fast_ms?: number;
    duration_standard_ms?: number;
    duration_slow_ms?: number;
    easing_standard?: string;
    easing_decelerate?: string;
    easing_accelerate?: string;
  };
  dark_mode?: Record<string, string>;
}

export interface Theme {
  extends?: string;
  colors: Record<string, string>;
  typography: {
    font_family_default?: string;
    font_family_mono?: string;
    scale: Record<string, string | number>;
  };
  spacing: Record<string, string | number>;
  radius: Record<string, string | number>;
  elevation: Record<string, string>;
  motion: {
    duration_fast_ms?: number;
    duration_standard_ms?: number;
    duration_slow_ms?: number;
    easing_standard?: string;
    easing_decelerate?: string;
    easing_accelerate?: string;
  };
  dark_mode?: Record<string, string>;
}

// ─────────────────────────────────────────────────────────────────────────────
// ICON REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

export interface IconEntry {
  type: IconType;
  path?: string;
  name?: string;
  component?: string;
  alt?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// BREAKPOINTS
// ─────────────────────────────────────────────────────────────────────────────

export interface Breakpoint {
  min_width_px: number;
  max_width_px?: number | null;
  label?: string;
  columns?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// NAVIGATION
// ─────────────────────────────────────────────────────────────────────────────

export interface Route {
  screen: string;
  path?: string;
  params?: Record<string, string>;
  auth_required?: boolean;
  feature_ref?: string;
}

export interface NavigationConfig {
  initial_screen: string;
  type: 'tab_bar' | 'drawer' | 'stack' | 'none';
  tab_bar_position?: 'top' | 'bottom';
  routes?: Record<string, Route>;
  guards?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// TRANSITIONS & ANIMATIONS
// ─────────────────────────────────────────────────────────────────────────────

export interface Transition {
  type:
    | 'fade'
    | 'slide_left'
    | 'slide_right'
    | 'slide_up'
    | 'slide_down'
    | 'scale'
    | 'flip'
    | 'shared_element'
    | 'custom';
  duration_ms?: number;
  easing?: string;
  delay_ms?: number;
  custom_handler?: string;
  shared_element_tag?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// ACCESSIBILITY
// ─────────────────────────────────────────────────────────────────────────────

export interface AccessibilityProps {
  label?: string;
  hint?: string;
  role?:
    | 'button'
    | 'link'
    | 'heading'
    | 'image'
    | 'list'
    | 'listitem'
    | 'checkbox'
    | 'radio'
    | 'switch'
    | 'slider'
    | 'tab'
    | 'tabpanel'
    | 'dialog'
    | 'alert'
    | 'status'
    | 'none';
  live_region?: 'off' | 'polite' | 'assertive';
  keyboard_shortcut?: string;
  focus_order?: number;
  min_touch_target_px?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// LOADING STATES
// ─────────────────────────────────────────────────────────────────────────────

export interface LoadingState {
  style?: 'spinner' | 'skeleton' | 'shimmer' | 'progress_bar' | 'overlay' | 'none';
  skeleton_rows?: number;
  overlay_opacity?: number;
  min_display_ms?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONDITIONS
// ─────────────────────────────────────────────────────────────────────────────

export type ConditionOrRef =
  | string
  | { ref: string }
  | {
      field: string;
      operator:
        | 'eq'
        | 'ne'
        | 'gt'
        | 'gte'
        | 'lt'
        | 'lte'
        | 'in'
        | 'not_in'
        | 'contains'
        | 'starts_with'
        | 'ends_with'
        | 'is_empty'
        | 'is_not_empty';
      value?: any;
    };

// ─────────────────────────────────────────────────────────────────────────────
// BUTTONS
// ─────────────────────────────────────────────────────────────────────────────

export interface Button {
  name: string;
  label?: string;
  button_type?: ButtonType;
  on_press: string; // ButtonActionType enum value or custom handler name
  custom_handler?: string;
  icon_ref?: string;
  icon_path?: string;
  background_pic_path?: string;
  text_size?: number | string;
  foreground_color?: string;
  background_color?: string;
  disabled_condition?: ConditionOrRef;
  hidden_condition?: ConditionOrRef;
  accessibility?: AccessibilityProps;
  confirm_dialog_ref?: string;
  analytics_event?: string;
}

export interface ButtonReference {
  button_ref: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// DATA BINDING
// ─────────────────────────────────────────────────────────────────────────────

export interface Pagination {
  type?: 'cursor' | 'page_number' | 'offset' | 'none';
  page_size?: number;
  page_param?: string;
  size_param?: string;
}

export interface SortConfig {
  field?: string;
  direction?: 'asc' | 'desc';
}

export interface DataBinding {
  source_ref?: string;
  query_params?: Record<string, string>;
  write_action_ref?: string;
  delete_action_ref?: string;
  pagination?: Pagination;
  sort?: SortConfig;
  polling_interval_ms?: number | null;
  optimistic_updates?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT LIFECYCLE
// ─────────────────────────────────────────────────────────────────────────────

export interface ComponentLifecycle {
  on_mount?: string;
  on_unmount?: string;
  on_focus?: string;
  on_blur?: string;
  on_data_load?: string;
  on_data_error?: string;
  on_refresh?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// GESTURE HANDLING
// ─────────────────────────────────────────────────────────────────────────────

export interface GestureHandler {
  gesture:
    | 'tap'
    | 'double_tap'
    | 'long_press'
    | 'swipe_left'
    | 'swipe_right'
    | 'swipe_up'
    | 'swipe_down'
    | 'pinch'
    | 'spread'
    | 'rotate';
  action_ref: string;
  condition?: ConditionOrRef;
  min_distance_px?: number;
  long_press_duration_ms?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// STATE FEEDBACK
// ─────────────────────────────────────────────────────────────────────────────

export interface EmptyState {
  text?: string;
  icon_ref?: string;
  action_ref?: string;
}

export interface ErrorState {
  text?: string;
  icon_ref?: string;
  retry_action_ref?: string;
}

export interface StateConfig {
  loading_state?: LoadingState;
  empty_state?: EmptyState;
  error_state?: ErrorState;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

export interface SubComponentPlacement {
  component_ref: string;
  direction: LayoutDirection;
  breakpoint?: string;
  hidden_condition?: ConditionOrRef;
}

export interface Component {
  name: string;
  label?: string;
  type: ComponentType;
  schema_ref?: string;
  form_ref?: string;
  data_binding?: DataBinding;
  text?: string;
  text_size?: number | string;
  foreground_color?: string;
  background_color?: string;
  background_pic_path?: string;
  fields?: string[];
  sections?: string[];
  sub_components?: SubComponentPlacement[];
  actions?: (Button | ButtonReference)[];
  breakpoint_overrides?: Record<string, Partial<Component>>;
  feature_ref?: string;
  hidden_condition?: ConditionOrRef;
  visible_access_levels?: string[];
  lifecycle?: ComponentLifecycle;
  loading_state?: LoadingState;
  empty_state?: EmptyState;
  error_state?: ErrorState;
  gestures?: GestureHandler[];
  accessibility?: AccessibilityProps;
  transition_in?: string;
  transition_out?: string;
  analytics_id?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// TOASTS & DIALOGS
// ─────────────────────────────────────────────────────────────────────────────

export interface Toast {
  message: string;
  severity?: 'info' | 'success' | 'warning' | 'error';
  duration_ms?: number;
  position?: 'top' | 'top_left' | 'top_right' | 'bottom' | 'bottom_left' | 'bottom_right';
  action_label?: string;
  action_ref?: string;
  icon_ref?: string;
}

export interface Dialog {
  title: string;
  body?: string;
  icon_ref?: string;
  severity?: 'info' | 'success' | 'warning' | 'error' | 'neutral';
  dismissible?: boolean;
  primary_action?: Button;
  secondary_action?: Button;
  component_ref?: string;
  max_width_px?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREENS
// ─────────────────────────────────────────────────────────────────────────────

export interface SecondaryScreenLink {
  screen_ref: string;
  access_type: ScreenAccessType;
  menu_label?: string;
  menu_order?: number;
  hidden_condition?: ConditionOrRef;
  params?: Record<string, string>;
}

export interface StatusBar {
  style?: 'light' | 'dark' | 'auto';
  background_color?: string;
}

export interface Screen {
  name: string;
  label?: string;
  icon_ref?: string;
  icon_path?: string;
  is_home?: boolean;
  nav_order?: number;
  components: SubComponentPlacement[];
  secondary_screens?: SecondaryScreenLink[];
  feature_ref?: string;
  allowed_role_categories?: string[];
  background_color?: string;
  background_pic_path?: string;
  on_enter?: string;
  on_exit?: string;
  on_back?: string;
  transition_in?: string;
  transition_out?: string;
  status_bar?: StatusBar;
  analytics_id?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURES
// ─────────────────────────────────────────────────────────────────────────────

export interface Feature {
  name: string;
  label?: string;
  confidentiality?: string;
  components?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// UI MANIFEST
// ─────────────────────────────────────────────────────────────────────────────

export interface UIDesignManifest {
  manifest_id: string;
  manifest_version?: string;
  description?: string;
  namespaces?: string[];
  theme: Theme;
  icons: Record<string, IconEntry>;
  breakpoints: Record<string, Breakpoint>;
  navigation: NavigationConfig;
  features: Record<string, Feature>;
  buttons: Record<string, Button>;
  components: Record<string, Component>;
  screens: Record<string, Screen>;
  toasts: Record<string, Toast>;
  dialogs: Record<string, Dialog>;
  transitions: Record<string, Transition>;
}

// ─────────────────────────────────────────────────────────────────────────────
// RUNTIME STATE & CONTEXT
// ─────────────────────────────────────────────────────────────────────────────

export interface UIEngineState {
  currentScreenKey: string;
  currentBreakpoint: string;
  isDarkMode: boolean;
  isAuthenticated: boolean;
  userRoleCategories: string[];
  enabledFeatures: string[];
  componentStates: Record<string, Record<string, any>>;
  navigationStack: string[];
}

export interface UIEngineContextValue {
  manifest: UIDesignManifest;
  state: UIEngineState;
  handlers: UIEngineHandlers;
  dispatch: (action: UIEngineAction) => void;
}

export interface UIEngineHandlers {
  [key: string]: (context: any) => Promise<void> | void;
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTIONS & REDUCERS
// ─────────────────────────────────────────────────────────────────────────────

export type UIEngineAction =
  | { type: 'SET_SCREEN'; payload: string }
  | { type: 'PUSH_SCREEN'; payload: string }
  | { type: 'POP_SCREEN' }
  | { type: 'SET_BREAKPOINT'; payload: string }
  | { type: 'SET_DARK_MODE'; payload: boolean }
  | { type: 'SET_AUTHENTICATED'; payload: boolean }
  | { type: 'SET_ROLE_CATEGORIES'; payload: string[] }
  | { type: 'SET_ENABLED_FEATURES'; payload: string[] }
  | { type: 'SET_COMPONENT_STATE'; payload: { componentId: string; state: Record<string, any> } }
  | { type: 'UPDATE_COMPONENT_STATE'; payload: { componentId: string; updates: Record<string, any> } };
