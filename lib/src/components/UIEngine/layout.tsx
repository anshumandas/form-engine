/**
 * UIEngine Layout System
 * Handles component positioning at different LayoutDirections
 */

import React, { useMemo } from 'react';
import { LayoutDirection, SubComponentPlacement } from './types';
import { useUIEngine, useConditionEvaluator, useTheme, useBreakpoint } from './context';
import { ComponentRenderer } from './renderers';

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT CONTAINER
// ─────────────────────────────────────────────────────────────────────────────

export interface LayoutProps {
  children: React.ReactNode;
  direction: LayoutDirection;
}

export const LayoutContainer: React.FC<LayoutProps> = ({ children, direction }) => {
  const theme = useTheme();
  const breakpoint = useBreakpoint();

  const getDirectionStyles = (): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      display: 'flex',
    };

    switch (direction) {
      case LayoutDirection.Center:
        return {
          ...baseStyle,
          flexDirection: 'column',
          flex: 1,
          justifyContent: 'flex-start',
          alignItems: 'stretch',
          minHeight: '400px',
          padding: `0 ${theme.spacing.md || '16px'}`,
        };

      case LayoutDirection.Top:
        return {
          ...baseStyle,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: theme.spacing.md || '16px',
          backgroundColor: theme.colors.primary || '#007AFF',
          color: 'white',
          minHeight: '56px',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          boxShadow: theme.elevation.default || '0 2px 4px rgba(0,0,0,0.1)',
        };

      case LayoutDirection.Bottom:
        return {
          ...baseStyle,
          flexDirection: 'row',
          justifyContent: 'space-around',
          alignItems: 'center',
          padding: theme.spacing.md || '16px',
          backgroundColor: theme.colors.surface || '#FFFFFF',
          borderTop: `1px solid ${theme.colors.outline || '#E0E0E0'}`,
          minHeight: '56px',
          position: 'sticky',
          bottom: 0,
          zIndex: 100,
        };

      case LayoutDirection.Left:
        return {
          ...baseStyle,
          flexDirection: 'column',
          justifyContent: 'flex-start',
          alignItems: 'stretch',
          width: breakpoint?.columns ? `${(breakpoint.columns / 24) * 100}%` : '250px',
          backgroundColor: theme.colors.surface || '#FFFFFF',
          borderRight: `1px solid ${theme.colors.outline || '#E0E0E0'}`,
          padding: theme.spacing.md || '16px',
          position: 'sticky',
          left: 0,
          top: 0,
          zIndex: 90,
          maxHeight: '100vh',
          overflowY: 'auto',
        };

      case LayoutDirection.Right:
        return {
          ...baseStyle,
          flexDirection: 'column',
          justifyContent: 'flex-start',
          alignItems: 'stretch',
          width: breakpoint?.columns ? `${(breakpoint.columns / 24) * 100}%` : '250px',
          backgroundColor: theme.colors.surface || '#FFFFFF',
          borderLeft: `1px solid ${theme.colors.outline || '#E0E0E0'}`,
          padding: theme.spacing.md || '16px',
          position: 'sticky',
          right: 0,
          top: 0,
          zIndex: 90,
          maxHeight: '100vh',
          overflowY: 'auto',
        };

      case LayoutDirection.Floating:
        return {
          ...baseStyle,
          flexDirection: 'column',
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: 'auto',
          minWidth: '56px',
          minHeight: '56px',
          borderRadius: '50%',
          backgroundColor: theme.colors.primary || '#007AFF',
          boxShadow: theme.elevation.default || '0 2px 8px rgba(0,0,0,0.15)',
          zIndex: 80,
        };

      case LayoutDirection.Modal:
        return {
          ...baseStyle,
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 200,
          backdropFilter: 'blur(4px)',
        };

      default:
        return baseStyle;
    }
  };

  return <div style={getDirectionStyles()}>{children}</div>;
};

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENT PLACEMENT RENDERER
// ─────────────────────────────────────────────────────────────────────────────

interface SubComponentRendererProps {
  placement: SubComponentPlacement;
}

export const SubComponentPlacementRenderer: React.FC<SubComponentRendererProps> = ({
  placement,
}) => {
  const { manifest } = useUIEngine();
  const evaluateCondition = useConditionEvaluator();
  const currentBreakpoint = useBreakpoint();

  // Check if placement should be shown at current breakpoint
  if (placement.breakpoint && currentBreakpoint?.label !== placement.breakpoint) {
    return null;
  }

  // Check if placement is hidden by condition
  if (placement.hidden_condition && !evaluateCondition(placement.hidden_condition)) {
    return null;
  }

  const component = manifest.components && manifest.components[placement.component_ref];
  if (!component) {
    console.warn(`Component not found: ${placement.component_ref}`);
    return null;
  }

  return (
    <ComponentRenderer
      component={component}
      componentId={placement.component_ref}
    />
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// DIRECTION-BASED LAYOUT GROUPER
// ─────────────────────────────────────────────────────────────────────────────

interface DirectionGroupProps {
  direction: LayoutDirection;
  placements: SubComponentPlacement[];
}

const DirectionGroup: React.FC<DirectionGroupProps> = ({ direction, placements }) => {
  const filteredPlacements = useMemo(
    () => placements.filter(p => p.direction === direction),
    [placements, direction]
  );

  if (filteredPlacements.length === 0) {
    return null;
  }

  return (
    <LayoutContainer direction={direction}>
      {filteredPlacements.map((placement, index) => (
        <SubComponentPlacementRenderer
          key={`${placement.component_ref}-${placement.direction}-${index}`}
          placement={placement}
        />
      ))}
    </LayoutContainer>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN LAYOUT RENDERER
// ─────────────────────────────────────────────────────────────────────────────

interface ScreenLayoutProps {
  componentPlacements: SubComponentPlacement[];
}

export const ScreenLayout: React.FC<ScreenLayoutProps> = ({ componentPlacements }) => {
  const theme = useTheme();

  const screenStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    backgroundColor: theme.colors.surface || '#FFFFFF',
    fontFamily: theme.typography.font_family_default || 'system-ui, sans-serif',
    color: theme.colors.on_surface || '#000',
  };

  return (
    <div style={screenStyle}>
      {/* Modal overlays from Modal direction */}
      <DirectionGroup direction={LayoutDirection.Modal} placements={componentPlacements} />

      {/* Top bar / header */}
      <DirectionGroup direction={LayoutDirection.Top} placements={componentPlacements} />

      {/* Main content area with left, center, right, and floating */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left sidebar */}
        <DirectionGroup direction={LayoutDirection.Left} placements={componentPlacements} />

        {/* Center content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          <DirectionGroup direction={LayoutDirection.Center} placements={componentPlacements} />
        </div>

        {/* Right sidebar */}
        <DirectionGroup direction={LayoutDirection.Right} placements={componentPlacements} />

        {/* Floating elements (FAB, etc.) */}
        <DirectionGroup direction={LayoutDirection.Floating} placements={componentPlacements} />
      </div>

      {/* Bottom bar / footer / tab bar */}
      <DirectionGroup direction={LayoutDirection.Bottom} placements={componentPlacements} />
    </div>
  );
};

ScreenLayout.displayName = 'ScreenLayout';

// ─────────────────────────────────────────────────────────────────────────────
// RESPONSIVE LAYOUT HANDLER
// ─────────────────────────────────────────────────────────────────────────────

interface ResponsiveLayoutProps {
  componentPlacements: SubComponentPlacement[];
}

export const ResponsiveLayout: React.FC<ResponsiveLayoutProps> = ({ componentPlacements }) => {
  const { dispatch } = useUIEngine();
  const breakpoint = useBreakpoint();

  // Handle responsive breakpoint changes
  React.useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      // Dispatch breakpoint update based on width
      // This would be expanded to check actual breakpoints
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [dispatch]);

  return <ScreenLayout componentPlacements={componentPlacements} />;
};
