export type FocusMode =
  | "deep_build"
  | "learning"
  | "revision"
  | "debugging"
  | "creative"
  | "sprint";

export type AmbientSound =
  | "silent"
  | "rain"
  | "cafe"
  | "keyboard"
  | "library"
  | "whitenoise";

export interface FocusChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface FocusSession {
  id: string;
  taskName: string;
  goalType: FocusMode;
  expectedOutcome?: string;
  checklist: FocusChecklistItem[];
  durationMinutes: number;
  actualDurationSeconds: number;
  isActive: boolean;
  mode: string;
  ambientSound: AmbientSound;
  startedAt: string;
  completedAt?: string;
  completed: boolean;
  distractionCount: number;
}

export interface FocusState {
  currentSession: FocusSession | null;
  history: FocusSession[];
  ambientSound: AmbientSound;
  currentMode: FocusMode;
  isFullscreen: boolean;
}

export interface FocusModeConfig {
  id: FocusMode;
  label: string;
  description: string;
  icon: string;
  accent: string;
  accentLight: string;
  accentGlow: string;
  bg: string;
  surface: string;
  surfaceHover: string;
  border: string;
  borderLight: string;
  text: string;
  textMuted: string;
  textFaint: string;
}

export const DESIGN_TOKENS = {
  colors: {
    bg: "#f6f4f1",
    bgElevated: "#fbfaf8",
    surface: "#fbfaf8",
    surfaceHover: "#f1efeb",
    surfaceElevated: "#f1efeb",
    border: "#ddd8d2",
    borderLight: "#ddd8d2",
    text: "#111111",
    textMuted: "#666666",
    textFaint: "#666666",
    accent: "#1d5cff",
    accentLight: "#dbe5ff",
    accentGlow: "rgba(29, 92, 255, 0.12)",
    accentSubtle: "rgba(29, 92, 255, 0.08)",
    success: "#34d399",
    successLight: "rgba(52, 211, 153, 0.12)",
    warning: "#fbbf24",
    warningLight: "rgba(251, 191, 36, 0.12)",
    danger: "#f87171",
    dangerLight: "rgba(248, 113, 113, 0.12)",
  },
  typography: {
    uiFont: "var(--font-geist-sans), sans-serif",
    monoFont: "var(--font-geist-mono), monospace",
    displayFont: "var(--font-geist-sans), sans-serif",
  },
  spacing: {
    xs: "4px",
    sm: "8px",
    md: "12px",
    lg: "16px",
    xl: "24px",
    "2xl": "32px",
    "3xl": "48px",
    "4xl": "64px",
  },
  radii: {
    sm: "0px",
    md: "0px",
    lg: "0px",
    xl: "0px",
    full: "0px",
  },
  motion: {
    fast: "120ms",
    base: "200ms",
    slow: "350ms",
    xslow: "600ms",
    easeOut: "cubic-bezier(0.16, 1, 0.3, 1)",
    easeInOut: "cubic-bezier(0.65, 0, 0.35, 1)",
    spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  },
  shadows: {
    sm: "none",
    md: "none",
    lg: "none",
    xl: "none",
    glow: "none",
  },
  sizing: {
    buttonSm: "32px",
    buttonMd: "40px",
    buttonLg: "48px",
    hitArea: "44px",
    sidebarWidth: "280px",
    headerHeight: "56px",
  },
  zIndices: {
    base: 1,
    dropdown: 10,
    overlay: 20,
    modal: 30,
    toast: 40,
  },
};

export const FOCUS_MODES: FocusModeConfig[] = [
  {
    id: "deep_build",
    label: "Deep Build",
    description: "Coding, building, creating",
    icon: "code",
    accent: "#1d5cff",
    accentLight: "#dbe5ff",
    accentGlow: "rgba(29, 92, 255, 0.12)",
    bg: "#f6f4f1",
    surface: "#fbfaf8",
    surfaceHover: "#f1efeb",
    border: "#ddd8d2",
    borderLight: "#ddd8d2",
    text: "#111111",
    textMuted: "#666666",
    textFaint: "#666666",
  },
  {
    id: "learning",
    label: "Learning",
    description: "Reading, watching, absorbing",
    icon: "book",
    accent: "#1d5cff",
    accentLight: "#dbe5ff",
    accentGlow: "rgba(29, 92, 255, 0.12)",
    bg: "#f6f4f1",
    surface: "#fbfaf8",
    surfaceHover: "#f1efeb",
    border: "#ddd8d2",
    borderLight: "#ddd8d2",
    text: "#111111",
    textMuted: "#666666",
    textFaint: "#666666",
  },
  {
    id: "revision",
    label: "Revision",
    description: "Reviewing, testing, recalling",
    icon: "refresh",
    accent: "#1d5cff",
    accentLight: "#dbe5ff",
    accentGlow: "rgba(29, 92, 255, 0.12)",
    bg: "#f6f4f1",
    surface: "#fbfaf8",
    surfaceHover: "#f1efeb",
    border: "#ddd8d2",
    borderLight: "#ddd8d2",
    text: "#111111",
    textMuted: "#666666",
    textFaint: "#666666",
  },
  {
    id: "debugging",
    label: "Debugging",
    description: "Fixing, solving, troubleshooting",
    icon: "bug",
    accent: "#1d5cff",
    accentLight: "#dbe5ff",
    accentGlow: "rgba(29, 92, 255, 0.12)",
    bg: "#f6f4f1",
    surface: "#fbfaf8",
    surfaceHover: "#f1efeb",
    border: "#ddd8d2",
    borderLight: "#ddd8d2",
    text: "#111111",
    textMuted: "#666666",
    textFaint: "#666666",
  },
  {
    id: "creative",
    label: "Creative",
    description: "Designing, thinking, exploring",
    icon: "sparkles",
    accent: "#1d5cff",
    accentLight: "#dbe5ff",
    accentGlow: "rgba(29, 92, 255, 0.12)",
    bg: "#f6f4f1",
    surface: "#fbfaf8",
    surfaceHover: "#f1efeb",
    border: "#ddd8d2",
    borderLight: "#ddd8d2",
    text: "#111111",
    textMuted: "#666666",
    textFaint: "#666666",
  },
  {
    id: "sprint",
    label: "Sprint",
    description: "Fast execution, rapid completion",
    icon: "zap",
    accent: "#1d5cff",
    accentLight: "#dbe5ff",
    accentGlow: "rgba(29, 92, 255, 0.12)",
    bg: "#f6f4f1",
    surface: "#fbfaf8",
    surfaceHover: "#f1efeb",
    border: "#ddd8d2",
    borderLight: "#ddd8d2",
    text: "#111111",
    textMuted: "#666666",
    textFaint: "#666666",
  },
];

export const AMBIENT_SOUNDS: { id: AmbientSound; label: string; icon: string }[] = [
  { id: "silent", label: "Silent", icon: "volume-off" },
  { id: "rain", label: "Rain", icon: "cloud-rain" },
  { id: "cafe", label: "Cafe", icon: "coffee" },
  { id: "keyboard", label: "Keys", icon: "keyboard" },
  { id: "library", label: "Library", icon: "book-open" },
  { id: "whitenoise", label: "White", icon: "waves" },
];

export const TIMER_PRESETS = [
  { minutes: 5, label: "5m", type: "break" },
  { minutes: 15, label: "15m", type: "short" },
  { minutes: 25, label: "25m", type: "default" },
  { minutes: 45, label: "45m", type: "medium" },
  { minutes: 60, label: "60m", type: "long" },
  { minutes: 90, label: "90m", type: "extended" },
];
