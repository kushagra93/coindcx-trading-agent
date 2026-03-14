export const tokens = {
  colors: {
    bg:           '#08090d',
    bgSurface:    '#0f1118',
    bgElevated:   '#161922',
    bgInput:      '#1a1d28',
    border:       '#1e2130',
    borderActive: '#d4a853',

    text:         '#e8e6e3',
    textSecondary:'#8b8a88',
    textMuted:    '#5a5957',

    accent:       '#d4a853',
    accentHover:  '#c49a42',
    accentSubtle: 'rgba(212, 168, 83, 0.08)',

    positive:     '#34d399',
    positiveBg:   'rgba(52, 211, 153, 0.08)',
    negative:     '#f87171',
    negativeBg:   'rgba(248, 113, 113, 0.08)',

    warning:      '#fbbf24',
    info:         '#60a5fa',
    purple:       '#a78bfa',
  },
  fonts: {
    sans: "'Instrument Sans', -apple-system, BlinkMacSystemFont, sans-serif",
    mono: "'JetBrains Mono', 'SF Mono', monospace",
  },
  radii: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    pill: 100,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
  },
  shadows: {
    card: '0 1px 3px rgba(0,0,0,0.3)',
    elevated: '0 8px 32px rgba(0,0,0,0.4)',
  },
  transitions: {
    fast: '0.12s ease',
    normal: '0.2s ease',
    slow: '0.35s ease-out',
  },
};

// Backward-compatible `colors` export remapped from new tokens
export const colors = {
  bg: tokens.colors.bg,
  bgCard: tokens.colors.bgSurface,
  bgCardHover: tokens.colors.bgElevated,
  bgInput: tokens.colors.bgInput,
  border: tokens.colors.border,
  borderActive: tokens.colors.borderActive,
  text: tokens.colors.text,
  textSecondary: tokens.colors.textSecondary,
  textMuted: tokens.colors.textMuted,
  primary: tokens.colors.accent,
  primaryHover: tokens.colors.accentHover,
  green: tokens.colors.positive,
  greenBg: tokens.colors.positiveBg,
  red: tokens.colors.negative,
  redBg: tokens.colors.negativeBg,
  yellow: tokens.colors.warning,
  yellowBg: 'rgba(251, 191, 36, 0.1)',
  purple: tokens.colors.purple,
  purpleBg: 'rgba(167, 139, 250, 0.1)',
};
