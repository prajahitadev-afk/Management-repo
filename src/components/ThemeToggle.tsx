import { Moon, Sun } from "lucide-react";
import type { AppTheme } from "../lib/theme";

export function ThemeToggle({ theme, onToggle }: { theme: AppTheme; onToggle: () => void }) {
  const nextTheme = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      className="portal-theme-toggle"
      aria-label={`Switch to ${nextTheme} mode`}
      aria-pressed={theme === "dark"}
      title={`Switch to ${nextTheme} mode`}
      onClick={onToggle}
    >
      {theme === "dark" ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
      <span className="sr-only">Switch to {nextTheme} mode</span>
    </button>
  );
}
