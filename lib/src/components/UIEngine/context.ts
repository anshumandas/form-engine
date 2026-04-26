/**
 * UIEngine Core Context and Hooks
 * Manages state, navigation, and component rendering
 *
 * Updated for ui_system.schema.yaml v1.0.0:
 *   - manifest.theme (singular) → manifest.themes[active_theme] (named registry)
 *   - navigation and features are now optional top-level sections
 *   - UIEngineState gains resolvedAuth and activeThemeKey
 *   - New actions: SET_RESOLVED_AUTH, SET_ACTIVE_THEME
 */

import React, { createContext, useContext, useReducer, useCallback, useMemo, ReactNode } from 'react';
import {
  UIEngineContextValue,
  UISystemManifest,
  UIEngineState,
  UIEngineAction,
  UIEngineHandlers,
  ThemeDefinition,
  ResolvedAuth,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXT CREATION
// ─────────────────────────────────────────────────────────────────────────────

export const UIEngineContext = createContext<UIEngineContextValue | undefined>(undefined);

// ─────────────────────────────────────────────────────────────────────────────
// FALLBACK THEME
// ─────────────────────────────────────────────────────────────────────────────

const EMPTY_THEME: ThemeDefinition = {
  colors: {},
  typography: { scale: {} },
  spacing: {},
  radius: {},
  elevation: {},
  motion: {},
};

// ─────────────────────────────────────────────────────────────────────────────
// INITIAL STATE
// ─────────────────────────────────────────────────────────────────────────────

export function createInitialState(manifest: UISystemManifest): UIEngineState {
  const activeThemeKey = manifest.active_theme ?? 'default';
  return {
    currentScreenKey: manifest.navigation?.initial_screen ?? '',
    currentBreakpoint: getInitialBreakpoint(manifest),
    isDarkMode: false,
    isAuthenticated: false,
    userRoleCategories: [],
    enabledFeatures: Object.keys(manifest.features ?? {}),
    componentStates: {},
    navigationStack: manifest.navigation ? [manifest.navigation.initial_screen] : [],
    resolvedAuth: undefined,
    activeThemeKey,
  };
}

function getInitialBreakpoint(manifest: UISystemManifest): string {
  const breakpoints = Object.entries(manifest.breakpoints ?? {}).sort(
    ([, a], [, b]) => a.min_width_px - b.min_width_px
  );
  return breakpoints[0]?.[0] || 'default';
}

// ─────────────────────────────────────────────────────────────────────────────
// REDUCER
// ─────────────────────────────────────────────────────────────────────────────

export function uiEngineReducer(state: UIEngineState, action: UIEngineAction): UIEngineState {
  switch (action.type) {
    case 'SET_SCREEN':
      return {
        ...state,
        currentScreenKey: action.payload,
        navigationStack: [action.payload],
      };

    case 'PUSH_SCREEN':
      return {
        ...state,
        currentScreenKey: action.payload,
        navigationStack: [...state.navigationStack, action.payload],
      };

    case 'POP_SCREEN': {
      const newStack = state.navigationStack.slice(0, -1);
      return {
        ...state,
        currentScreenKey: newStack[newStack.length - 1] || state.navigationStack[0],
        navigationStack: newStack.length > 0 ? newStack : state.navigationStack,
      };
    }

    case 'SET_BREAKPOINT':
      return { ...state, currentBreakpoint: action.payload };

    case 'SET_DARK_MODE':
      return { ...state, isDarkMode: action.payload };

    case 'SET_AUTHENTICATED':
      return { ...state, isAuthenticated: action.payload };

    case 'SET_ROLE_CATEGORIES':
      return { ...state, userRoleCategories: action.payload };

    case 'SET_ENABLED_FEATURES':
      return { ...state, enabledFeatures: action.payload };

    case 'SET_COMPONENT_STATE':
      return {
        ...state,
        componentStates: {
          ...state.componentStates,
          [action.payload.componentId]: action.payload.state,
        },
      };

    case 'UPDATE_COMPONENT_STATE':
      return {
        ...state,
        componentStates: {
          ...state.componentStates,
          [action.payload.componentId]: {
            ...state.componentStates[action.payload.componentId],
            ...action.payload.updates,
          },
        },
      };

    case 'SET_RESOLVED_AUTH':
      return { ...state, resolvedAuth: action.payload };

    case 'SET_ACTIVE_THEME':
      return { ...state, activeThemeKey: action.payload };

    default:
      return state;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

interface UIEngineProviderProps {
  manifest: UISystemManifest;
  handlers?: UIEngineHandlers;
  children: ReactNode;
}

export function UIEngineProvider({
  manifest,
  handlers = {},
  children,
}: UIEngineProviderProps) {
  const [state, dispatch] = useReducer(uiEngineReducer, manifest, createInitialState);

  const value: UIEngineContextValue = useMemo(
    () => ({ manifest, state, handlers, dispatch }),
    [manifest, state, handlers]
  );

  return (
    <UIEngineContext.Provider value={value}>{children}</UIEngineContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOKS
// ─────────────────────────────────────────────────────────────────────────────

export function useUIEngine(): UIEngineContextValue {
  const context = useContext(UIEngineContext);
  if (!context) {
    throw new Error('useUIEngine must be used within a UIEngineProvider');
  }
  return context;
}

export function useCurrentScreen() {
  const { manifest, state } = useUIEngine();
  return manifest.screens?.[state.currentScreenKey];
}

export function useComponent(componentKey: string) {
  const { manifest } = useUIEngine();
  return manifest.components?.[componentKey];
}

export function useButton(buttonKey: string) {
  const { manifest } = useUIEngine();
  return manifest.buttons?.[buttonKey];
}

export function useIcon(iconKey: string) {
  const { manifest } = useUIEngine();
  return manifest.icons?.[iconKey];
}

/**
 * Resolves the active theme following the layered model:
 *   1. Base theme (ThemeDefinition.extends)
 *   2. Active theme tokens
 *   3. Dark-mode token overrides (when isDarkMode)
 *
 * Returns EMPTY_THEME when the active key is not found in manifest.themes
 * (e.g. when using a runtime built-in like "default" | "material" | "ios-hig" | "fluent").
 */
export function useTheme(): ThemeDefinition {
  const { manifest, state } = useUIEngine();
  const isDark = state.isDarkMode;
  const themes = manifest.themes ?? {};
  const activeKey = state.activeThemeKey;
  const theme = themes[activeKey] ?? EMPTY_THEME;

  return {
    ...theme,
    colors: {
      ...theme.colors,
      ...(isDark && theme.dark_mode ? theme.dark_mode : {}),
    },
  };
}

export function useBreakpoint() {
  const { manifest, state } = useUIEngine();
  return (manifest.breakpoints ?? {})[state.currentBreakpoint];
}

export function useNavigation() {
  const { dispatch, state } = useUIEngine();

  return {
    push: useCallback(
      (screenKey: string) => dispatch({ type: 'PUSH_SCREEN', payload: screenKey }),
      [dispatch]
    ),
    pop: useCallback(() => dispatch({ type: 'POP_SCREEN' }), [dispatch]),
    setScreen: useCallback(
      (screenKey: string) => dispatch({ type: 'SET_SCREEN', payload: screenKey }),
      [dispatch]
    ),
    currentScreen: state.currentScreenKey,
    canGoBack: state.navigationStack.length > 1,
  };
}

export function useComponentState(componentId: string) {
  const { state, dispatch } = useUIEngine();
  const componentState = state.componentStates[componentId] || {};

  const setState = useCallback(
    (newState: Record<string, any>) =>
      dispatch({ type: 'SET_COMPONENT_STATE', payload: { componentId, state: newState } }),
    [componentId, dispatch]
  );

  const updateState = useCallback(
    (updates: Record<string, any>) =>
      dispatch({ type: 'UPDATE_COMPONENT_STATE', payload: { componentId, updates } }),
    [componentId, dispatch]
  );

  return { state: componentState, setState, updateState };
}

export function useFeatureGate(featureRef: string | undefined) {
  const { state } = useUIEngine();
  return featureRef ? state.enabledFeatures.includes(featureRef) : true;
}

export function useAccessControl(
  requiredRoles: string[] | undefined,
  requiredAccessLevels: string[] | undefined
) {
  const { state } = useUIEngine();

  const hasRoleAccess =
    !requiredRoles ||
    requiredRoles.length === 0 ||
    requiredRoles.some(r => state.userRoleCategories.includes(r));

  const hasAccessLevel =
    !requiredAccessLevels ||
    requiredAccessLevels.length === 0 ||
    (state.resolvedAuth?.accessLevel != null &&
      requiredAccessLevels.includes(state.resolvedAuth.accessLevel));

  return hasRoleAccess && hasAccessLevel;
}

export function useResolvedAuth(): ResolvedAuth | undefined {
  const { state } = useUIEngine();
  return state.resolvedAuth;
}

/**
 * Returns an auth-field allowlist check function.
 * When auth.fields is non-empty, only the listed field IDs pass.
 * An empty / absent auth.fields means all fields are visible.
 */
export function useAuthFieldFilter(): (fieldId: string) => boolean {
  const { state } = useUIEngine();
  const allowedFields = state.resolvedAuth?.fields;
  if (!allowedFields || allowedFields.length === 0) return () => true;
  const set = new Set(allowedFields);
  return (fieldId: string) => set.has(fieldId);
}

export function useConditionEvaluator() {
  const { state } = useUIEngine();

  return useCallback(
    (
      condition:
        | string
        | { ref?: string; field?: string; operator?: string; value?: any }
        | undefined
    ) => {
      if (!condition) return true;

      if (typeof condition === 'string') {
        try {
          // Placeholder — replace with jexl or similar in production
          return true;
        } catch {
          console.warn('Failed to evaluate condition:', condition);
          return true;
        }
      }

      if ('ref' in condition) {
        // Named condition resolved via manifest.conditions
        return true;
      }

      if ('field' in condition && 'operator' in condition) {
        const { field, operator, value } = condition;
        const fieldValue = (state.componentStates as any)[field!];

        switch (operator) {
          case 'eq':            return fieldValue === value;
          case 'ne':            return fieldValue !== value;
          case 'gt':            return fieldValue > value;
          case 'gte':           return fieldValue >= value;
          case 'lt':            return fieldValue < value;
          case 'lte':           return fieldValue <= value;
          case 'in':            return Array.isArray(value) && value.includes(fieldValue);
          case 'not_in':        return !Array.isArray(value) || !value.includes(fieldValue);
          case 'contains':      return String(fieldValue).includes(String(value));
          case 'starts_with':   return String(fieldValue).startsWith(String(value));
          case 'ends_with':     return String(fieldValue).endsWith(String(value));
          case 'is_empty':      return !fieldValue || (fieldValue as any).length === 0;
          case 'is_not_empty':  return fieldValue && (fieldValue as any).length > 0;
          default:              return true;
        }
      }

      return true;
    },
    [state]
  );
}

export function useResponsiveValue<T>(values: Record<string, T>, defaultValue: T): T {
  const { state } = useUIEngine();
  return values[state.currentBreakpoint] ?? values['default'] ?? defaultValue;
}

export function useTransition(transitionKey: string | undefined) {
  const { manifest } = useUIEngine();
  if (!transitionKey) return undefined;
  return manifest.transitions?.[transitionKey];
}

export function useToast(toastKey: string | undefined) {
  const { manifest } = useUIEngine();
  if (!toastKey) return undefined;
  return manifest.toasts?.[toastKey];
}

export function useDialog(dialogKey: string | undefined) {
  const { manifest } = useUIEngine();
  if (!dialogKey) return undefined;
  return manifest.dialogs?.[dialogKey];
}

/** Returns all available themes keyed by name, including built-in runtime names. */
export function useThemeRegistry(): Record<string, ThemeDefinition> {
  const { manifest } = useUIEngine();
  return manifest.themes ?? {};
}

/** Switches the active theme at runtime. */
export function useThemeSwitcher() {
  const { dispatch } = useUIEngine();
  return useCallback(
    (themeKey: string) => dispatch({ type: 'SET_ACTIVE_THEME', payload: themeKey }),
    [dispatch]
  );
}
