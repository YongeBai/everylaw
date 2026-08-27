"use client";

import { useState } from "react";
import { TERM_DEFINITIONS } from "@/lib/terms";
import styles from "@/app/r/reddit.module.css";

/**
 * Renders official statute HTML with curated terms of art highlighted;
 * clicking a term opens its definition inline (annotated-edition feature).
 */
export function OfficialText({ html }: { html: string }) {
  const [active, setActive] = useState<string | null>(null);
  const definition = active ? TERM_DEFINITIONS.find((entry) => entry.term.toLowerCase() === active.toLowerCase()) ?? null : null;

  function onClick(event: React.MouseEvent) {
    const target = (event.target as HTMLElement).closest("[data-term]");
    if (target) setActive((now) => (now === target.getAttribute("data-term") ? null : target.getAttribute("data-term")));
  }

  return <div>
    <div className={styles.officialBody} data-testid="official-text" onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />
    {definition && <aside className={styles.termDef} data-testid="term-definition" role="note">
      <b>“{definition.term}”</b>
      <p>{definition.definition}</p>
      <button className={styles.linkButton} onClick={() => setActive(null)}>close</button>
    </aside>}
    <p className={styles.termHint}>Dotted terms are terms of art — click one for its definition.</p>
  </div>;
}
