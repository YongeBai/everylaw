"use client";

import { useSyncExternalStore } from "react";
import styles from "@/app/r/reddit.module.css";

/**
 * RES-style night mode. An explicit choice is stamped on <html data-theme> and
 * persisted; before any choice, the system preference decides (see globals.css
 * and the boot script in the root layout).
 */

function currentTheme(): "dark" | "light" {
  const chosen = document.documentElement.getAttribute("data-theme");
  if (chosen === "dark" || chosen === "light") return chosen;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

let notify = () => {};
const subscribe = (onChange: () => void) => {
  notify = onChange;
  const media = matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", onChange);
  return () => { notify = () => {}; media.removeEventListener("change", onChange); };
};

export function ThemeToggle() {
  // Server snapshot says "light" so SSR + first client render agree; the real
  // theme replaces it right after hydration.
  const theme = useSyncExternalStore(subscribe, currentTheme, () => "light");

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("theme", next); } catch { /* private browsing */ }
    notify();
  }

  return <button type="button" className={styles.nightMode} data-testid="night-mode" onClick={toggle}>
    {theme === "dark" ? "day mode" : "night mode"}
  </button>;
}
