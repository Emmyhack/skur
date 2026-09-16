/** Skur's two grounds. Same tokens in both, so a screen never needs to know which one is on. */
export type Palette = {
  canvas: string; card: string; card2: string; border: string;
  text: string; text2: string; text3: string;
  accent: string; accentBg: string; onAccent: string;
  success: string; successBg: string; warning: string; warningBg: string;
  error: string; errorBg: string; info: string; infoBg: string;
  shadowOpacity: number;
};

export const LIGHT: Palette = {
  canvas: "#ffffff", card: "#f6f7f9", card2: "#eceef2", border: "#e4e7ec",
  text: "#101418", text2: "#667085", text3: "#98a2b3",
  accent: "#ffd000", accentBg: "#fff6cc", onAccent: "#101418",
  success: "#11875a", successBg: "#e6f6ec", warning: "#a86a00", warningBg: "#fff3d6",
  error: "#b42318", errorBg: "#ffe4e2", info: "#1971c2", infoBg: "#e7f1ff",
  shadowOpacity: 0.08,
};

export const DARK: Palette = {
  canvas: "#212529", card: "#2b3035", card2: "#343a40", border: "#495057",
  text: "#f8f9fa", text2: "#adb5bd", text3: "#6c757d",
  accent: "#ffd000", accentBg: "#3d3400", onAccent: "#212529",
  success: "#75b798", successBg: "#1b4332", warning: "#ffa94d", warningBg: "#4d2e05",
  error: "#ea868f", errorBg: "#4a1c22", info: "#6ea8fe", infoBg: "#1b3a5c",
  shadowOpacity: 0.4,
};

export const F = {
  display: "SpaceGrotesk_700Bold",
  displayMedium: "SpaceGrotesk_600SemiBold",
  body: "DMSans_400Regular",
  bodyMedium: "DMSans_500Medium",
  bodyBold: "DMSans_700Bold",
  mono: "DMMono_400Regular",
  monoMedium: "DMMono_500Medium",
} as const;

export const R = { sm: 8, md: 12, lg: 16, pill: 999 } as const;
