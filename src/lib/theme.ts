export type AppTheme = "light" | "dark";

export function getStoredTheme(): AppTheme | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem("theme");
    return stored === "light" || stored === "dark" ? stored : null;
  } catch (error) {
    console.error("Unable to read saved theme preference", error);
    return null;
  }
}

export function getSystemTheme(): AppTheme {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function resolveTheme(theme?: string | null): AppTheme {
  if (theme === "dark" || theme === "light") return theme;
  return getSystemTheme();
}

export function applyTheme(theme: AppTheme, persist = false) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
  if (persist && typeof window !== "undefined") {
    try {
      window.localStorage.setItem("theme", theme);
    } catch (error) {
      console.error("Unable to save theme preference", error);
    }
  }
}

export function initializeTheme() {
  const theme = resolveTheme(getStoredTheme());
  applyTheme(theme);
  return theme;
}

export function toggleTheme() {
  const nextTheme = document.documentElement.classList.contains("dark") ? "light" : "dark";
  applyTheme(nextTheme, true);
  return nextTheme;
}
