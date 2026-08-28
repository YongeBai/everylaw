"use client";

import { useSyncExternalStore } from "react";
import styles from "@/app/(reader)/reader.module.css";

/**
 * RES-style night mode. Light is the default; choosing night mode stamps
 * <html data-theme> and persists it (see globals.css and the boot script in
 * the root layout).
 */

function currentTheme(): "dark" | "light" {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

let notify = () => {};
const subscribe = (onChange: () => void) => {
  notify = onChange;
  return () => { notify = () => {}; };
};

export function ThemeToggle() {
  // Server snapshot matches the light default, so SSR and the first client
  // render agree; a stored dark choice replaces it right after hydration.
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
