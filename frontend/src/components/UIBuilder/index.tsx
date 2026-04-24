/**
 * UIBuilder - Frontend UI Design Builder Component
 * Renders screens and components from UI design manifests
 * Integrates with the UIEngine core library
 */

import React, { useMemo, useCallback, useState } from 'react';
import {
  UIEngineProvider,
  useUIEngine,
  useCurrentScreen,
  useNavigation,
  useTheme,
  type UIDesignManifest,
  type UIEngineHandlers,
} from '../../components/UIEngine';
import { ScreenLayout } from '../../components/UIEngine/layout';

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN RENDERER
// ─────────────────────────────────────────────────────────────────────────────

const ScreenContent: React.FC = () => {
  const screen = useCurrentScreen();
  const theme = useTheme();
  const { manifest } = useUIEngine();

  if (!screen) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          fontSize: '18px',
          color: theme.colors.error || '#BA1A1A',
        }}
      >
        Screen not found
      </div>
    );
  }

  const screenStyle: React.CSSProperties = {
    minHeight: '100vh',
    backgroundColor: screen.background_color
      ? `#${screen.background_color}`
      : theme.colors.surface || '#FFFFFF',
    backgroundImage: screen.background_pic_path ? `url(${screen.background_pic_path})` : undefined,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };

  return (
    <div style={screenStyle}>
      {/* Optional status bar styling for mobile */}
      {screen.status_bar && (
        <div
          style={{
            height: '24px',
            backgroundColor: screen.status_bar.background_color
              ? `#${screen.status_bar.background_color}`
              : 'transparent',
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 300,
          }}
        />
      )}

      {/* Screen content with layout system */}
      <ScreenLayout componentPlacements={screen.components} />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// NAVIGATION DRAWER RENDERER
// ─────────────────────────────────────────────────────────────────────────────

interface NavigationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const NavigationDrawer: React.FC<NavigationDrawerProps> = ({ isOpen, onClose }) => {
  const { manifest } = useUIEngine();
  const { push } = useNavigation();
  const theme = useTheme();

  const homeScreens = Object.entries(manifest.screens)
    .filter(([, screen]) => screen.is_home)
    .sort((a, b) => (a[1].nav_order || 0) - (b[1].nav_order || 0));

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 150,
        }}
      />

      {/* Drawer */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          height: '100vh',
          width: '280px',
          backgroundColor: theme.colors.surface || '#FFFFFF',
          boxShadow: theme.elevation.default || '0 2px 8px rgba(0,0,0,0.15)',
          zIndex: 160,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Drawer header */}
        <div
          style={{
            padding: '16px',
            borderBottom: `1px solid ${theme.colors.outline || '#E0E0E0'}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '20px' }}>{manifest.manifest_id}</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        {/* Navigation items */}
        <nav style={{ flex: 1, padding: '16px 0' }}>
          {homeScreens.map(([screenKey, screen]) => (
            <button
              key={screenKey}
              onClick={() => {
                push(screenKey);
                onClose();
              }}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: 'none',
                backgroundColor: 'transparent',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '16px',
                color: theme.colors.on_surface || '#000',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor =
                  theme.colors.primary + '20' || 'rgba(0,0,0,0.05)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
              }}
            >
              {screen.icon_ref && (
                <span style={{ marginRight: '8px' }}>📄</span>
              )}
              {screen.label || screen.name}
            </button>
          ))}
        </nav>
      </div>
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// TAB BAR RENDERER
// ─────────────────────────────────────────────────────────────────────────────

interface TabBarProps {
  onMenuClick?: () => void;
}

const TabBar: React.FC<TabBarProps> = ({ onMenuClick }) => {
  const { manifest, state } = useUIEngine();
  const { push } = useNavigation();
  const theme = useTheme();

  const homeScreens = Object.entries(manifest.screens)
    .filter(([, screen]) => screen.is_home)
    .sort((a, b) => (a[1].nav_order || 0) - (b[1].nav_order || 0));

  const tabBarPosition = manifest.navigation.tab_bar_position || 'bottom';
  const isBottom = tabBarPosition === 'bottom';

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: theme.colors.surface || '#FFFFFF',
        borderTop: isBottom ? `1px solid ${theme.colors.outline || '#E0E0E0'}` : 'none',
        borderBottom: !isBottom ? `1px solid ${theme.colors.outline || '#E0E0E0'}` : 'none',
        padding: '8px 0',
        position: isBottom ? 'fixed' : 'sticky',
        bottom: isBottom ? 0 : 'auto',
        top: !isBottom ? 0 : 'auto',
        left: 0,
        right: 0,
        zIndex: 100,
      }}
    >
      {onMenuClick && (
        <button
          onClick={onMenuClick}
          style={{
            flex: 1,
            background: 'none',
            border: 'none',
            padding: '8px',
            cursor: 'pointer',
            fontSize: '24px',
          }}
        >
          ☰
        </button>
      )}

      {homeScreens.map(([screenKey, screen]) => {
        const isActive = state.currentScreenKey === screenKey;
        return (
          <button
            key={screenKey}
            onClick={() => push(screenKey)}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              padding: '8px',
              cursor: 'pointer',
              color: isActive
                ? theme.colors.primary || '#007AFF'
                : theme.colors.on_surface || '#666',
              fontSize: '12px',
              fontWeight: isActive ? 'bold' : 'normal',
              transition: 'all 0.2s',
              borderBottom: isActive && isBottom ? `3px solid ${theme.colors.primary}` : 'none',
              borderTop: isActive && !isBottom ? `3px solid ${theme.colors.primary}` : 'none',
            }}
          >
            <div style={{ fontSize: '20px', marginBottom: '4px' }}>
              {screen.icon_ref ? '📄' : '○'}
            </div>
            {screen.label || screen.name}
          </button>
        );
      })}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN UI BUILDER COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

interface UIBuilderInnerProps {
  showNavigation?: boolean;
  navigationMode?: 'drawer' | 'tab_bar' | 'none';
}

const UIBuilderInner: React.FC<UIBuilderInnerProps> = ({
  showNavigation = true,
  navigationMode: override,
}) => {
  const { manifest } = useUIEngine();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const navigationMode = override || manifest.navigation.type || 'tab_bar';
  const shouldShowNav = showNavigation && navigationMode !== 'none';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        width: '100%',
      }}
    >
      {navigationMode === 'drawer' && shouldShowNav && (
        <>
          <div
            style={{
              padding: '8px',
              backgroundColor: manifest.theme.colors.primary || '#007AFF',
            }}
          >
            <button
              onClick={() => setDrawerOpen(!drawerOpen)}
              style={{
                background: 'none',
                border: 'none',
                color: 'white',
                fontSize: '24px',
                cursor: 'pointer',
                padding: '8px',
              }}
            >
              ☰
            </button>
          </div>
          <NavigationDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
        </>
      )}

      {navigationMode === 'tab_bar' && shouldShowNav && (
        <TabBar onMenuClick={() => setDrawerOpen(!drawerOpen)} />
      )}

      {/* Main content area */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <ScreenContent />
      </div>

      {navigationMode === 'tab_bar' && shouldShowNav && (
        <div style={{ height: '56px' }} />
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

export interface UIBuilderProps {
  manifest: UIDesignManifest;
  handlers?: UIEngineHandlers;
  showNavigation?: boolean;
  navigationMode?: 'drawer' | 'tab_bar' | 'none';
}

/**
 * UIBuilder Component
 * Main component for rendering UI designs from manifests
 *
 * @example
 * ```tsx
 * import { UIBuilder } from '@/components/UIBuilder';
 * import manifest from './ui_design.yaml';
 *
 * export default function App() {
 *   return (
 *     <UIBuilder
 *       manifest={manifest}
 *       handlers={{
 *         handleSubmit: async (context) => { ... },
 *       }}
 *     />
 *   );
 * }
 * ```
 */
export const UIBuilder: React.FC<UIBuilderProps> = ({
  manifest,
  handlers,
  showNavigation = true,
  navigationMode,
}) => {
  return (
    <UIEngineProvider manifest={manifest} handlers={handlers}>
      <UIBuilderInner showNavigation={showNavigation} navigationMode={navigationMode} />
    </UIEngineProvider>
  );
};

UIBuilder.displayName = 'UIBuilder';

export default UIBuilder;
