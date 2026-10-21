// Aplica o tema atual no <html> via atributo data-theme.
// "system" acompanha a preferência do sistema operacional em tempo real.

import { useEffect } from "react";
import { Theme } from "@/store/appStore";

export function useTheme(theme: Theme): void {
  useEffect(() => {
    const root = document.documentElement;

    function resolve(): "light" | "dark" {
      if (theme === "system") {
        return window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
      }
      return theme;
    }

    function apply() {
      root.setAttribute("data-theme", resolve());
    }

    apply();

    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }
  }, [theme]);
}
