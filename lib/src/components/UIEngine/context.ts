/**
 * UIEngine Core Context and Hooks
 * Manages state, navigation, and component rendering
 */

import React, { createContext, useContext, useReducer, useCallback, useMemo, ReactNode } from 'react';
import {
  UIEngineContextValue,
  UIDesignManifest,
  UIEngineState,
  UIEngineAction,
  UIEngineHandlers,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXT CREATION
// ─────────────────────────────────────────────────────────────────────────────

export const UIEngineContext = createContext<UIEngineContextValue | undefined>(undefined);

// ─────────────────────────────────────────────────────────────────────────────
// INITIAL STATE
// ─────────────────────────────────────────────────────────────────────────────

export function createInitialState(manifest: UIDesignManifest): UIEngineState {
  return {
    currentScreenKey: manifest.navigation.initial_screen,
    currentBreakpoint: getInitialBreakpoint(manifest),
    isDarkMode: false,
    isAuthenticated: false,
    userRoleCategories: [],
    enabledFeatures: Object.keys(manifest.features),
    componentStates: {},
    navigationStack: [manifest.navigation.initial_screen],
  };
}

function getInitialBreakpoint(manifest: UIDesignManifest): string {
  const breakpoints = Object.entries(manifest.breakpoints).sort(
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
      return {
        ...state,
        currentBreakpoint: action.payload,
      };

    case 'SET_DARK_MODE':
      return {
        ...state,
        isDarkMode: action.payload,
      };

    case 'SET_AUTHENTICATED':
      return {
        ...state,
        isAuthenticated: action.payload,
      };

    case 'SET_ROLE_CATEGORIES':
      return {
        ...state,
        userRoleCategories: action.payload,
      };

    case 'SET_ENABLED_FEATURES':
      return {
        ...state,
        enabledFeatures: action.payload,
      };

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

    default:
      return state;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

interface UIEngineProviderProps {
  manifest: UIDesignManifest;
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
    () => ({
      manifest,
      state,
      handlers,
      dispatch,
    }),
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
  return manifest.screens[state.currentScreenKey];
}

export function useComponent(componentKey: string) {
  const { manifest } = useUIEngine();
  return manifest.components[componentKey];
}

export function useButton(buttonKey: string) {
  const { manifest } = useUIEngine();
  return manifest.buttons[buttonKey];
}

export function useIcon(iconKey: string) {
  const { manifest } = useUIEngine();
  return manifest.icons[iconKey];
}

export function useTheme() {
  const { manifest, state } = useUIEngine();
  const isDark = state.isDarkMode;
  return {
    ...manifest.theme,
    colors: {
      ...manifest.theme.colors,
      ...(isDark && manifest.theme.dark_mode ? manifest.theme.dark_mode : {}),
    },
  };
}

export function useBreakpoint() {
  const { manifest, state } = useUIEngine();
  return manifest.breakpoints[state.currentBreakpoint];
}

export function useNavigation() {
  const { dispatch, state } = useUIEngine();

  return {
    push: useCallback(
      (screenKey: string) => {
        dispatch({ type: 'PUSH_SCREEN', payload: screenKey });
      },
      [dispatch]
    ),
    pop: useCallback(() => {
      dispatch({ type: 'POP_SCREEN' });
    }, [dispatch]),
    setScreen: useCallback(
      (screenKey: string) => {
        dispatch({ type: 'SET_SCREEN', payload: screenKey });
      },
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
    (newState: Record<string, any>) => {
      dispatch({
        type: 'SET_COMPONENT_STATE',
        payload: { componentId, state: newState },
      });
    },
    [componentId, dispatch]
  );

  const updateState = useCallback(
    (updates: Record<string, any>) => {
      dispatch({
        type: 'UPDATE_COMPONENT_STATE',
        payload: { componentId, updates },
      });
    },
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
    !requiredRoles || requiredRoles.length === 0 || requiredRoles.some(r => 
      state.userRoleCategories.includes(r)
    );

  const hasAccessLevel =
    !requiredAccessLevels || requiredAccessLevels.length === 0; // Simplified - full implementation would check access levels

  return hasRoleAccess && hasAccessLevel;
}

export function useConditionEvaluator() {
  const { state, manifest } = useUIEngine();

  return useCallback(
    (condition: string | { ref?: string; field?: string; operator?: string; value?: any } | undefined) => {
      if (!condition) return true;

      if (typeof condition === 'string') {
        // Simple expression evaluation - in production use a proper expression evaluator
        try {
          // This is a placeholder - use a library like jexl or similar for production
          return true;
        } catch {
          console.warn('Failed to evaluate condition:', condition);
          return true;
        }
      }

      if ('ref' in condition) {
        // Reference to named condition in manifest
        // Implementation depends on manifest structure for named conditions
        return true;
      }

      if ('field' in condition && 'operator' in condition) {
        // Structured condition evaluation
        const { field, operator, value } = condition;
        const fieldValue = (state.componentStates as any)[field];

        switch (operator) {
          case 'eq':
            return fieldValue === value;
          case 'ne':
            return fieldValue !== value;
          case 'gt':
            return fieldValue > value;
          case 'gte':
            return fieldValue >= value;
          case 'lt':
            return fieldValue < value;
          case 'lte':
            return fieldValue <= value;
          case 'in':
            return Array.isArray(value) && value.includes(fieldValue);
          case 'not_in':
            return !Array.isArray(value) || !value.includes(fieldValue);
          case 'contains':
            return String(fieldValue).includes(String(value));
          case 'starts_with':
            return String(fieldValue).startsWith(String(value));
          case 'ends_with':
            return String(fieldValue).endsWith(String(value));
          case 'is_empty':
            return !fieldValue || fieldValue.length === 0;
          case 'is_not_empty':
            return fieldValue && fieldValue.length > 0;
          default:
            return true;
        }
      }

      return true;
    },
    [state]
  );
}

export function useResponsiveValue<T>(values: Record<string, T>, defaultValue: T): T {
  const { state, manifest } = useUIEngine();
  return values[state.currentBreakpoint] ?? values['default'] ?? defaultValue;
}

export function useTransition(transitionKey: string | undefined) {
  const { manifest } = useUIEngine();
  if (!transitionKey) return undefined;
  return manifest.transitions[transitionKey];
}

export function useToast(toastKey: string | undefined) {
  const { manifest } = useUIEngine();
  if (!toastKey) return undefined;
  return manifest.toasts[toastKey];
}

export function useDialog(dialogKey: string | undefined) {
  const { manifest } = useUIEngine();
  if (!dialogKey) return undefined;
  return manifest.dialogs[dialogKey];
}
