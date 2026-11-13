import { useCallback, useEffect, useRef, useState } from "react";
import { applyTheme, getStoredTheme, getSystemTheme, type AppTheme } from "../lib/theme";

export function usePortalTheme() {
  const [theme, setTheme] = useState<AppTheme>(() => getStoredTheme() ?? getSystemTheme());
  const isInitialRender = useRef(true);

  useEffect(() => {
    applyTheme(theme, !isInitialRender.current);
    isInitialRender.current = false;
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((currentTheme) => currentTheme === "dark" ? "light" : "dark");
  }, []);

  return { theme, toggleTheme };
}
