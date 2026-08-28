"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { CitationText } from "@/components/r/citation-text";
import { TERM_DEFINITIONS } from "@/lib/terms";
import styles from "@/app/r/reddit.module.css";

/** A statutory defined term in scope for the displayed section (see lib/data). */
export type StatutoryTerm = {
  id: number;
  term: string;
  definition: string;
  scopeType: string;
  citation: string;
  heading: string | null;
  url: string;
};

const SCOPE_PHRASES: Record<string, string> = {
  title: "this definition applies throughout the title",
  part: "this definition applies throughout its part",
  chapter: "this definition applies throughout its chapter",
  subchapter: "this definition applies throughout its subchapter",
  subpart: "this definition applies throughout its subpart",
  division: "this definition applies throughout its division",
  section: "this definition applies in the defining section",
};

type CardState = { termId: number; top: number; left: number; pinned: boolean };
type TermCardState = { term: string; top: number; left: number };

/**
 * Renders official statute HTML with two layers of annotation: statutory
 * defined terms (starred; hover or click opens a card with the statute's own
 * definition, linking to the defining section and the title's wiki) and
 * curated terms of art (dotted; clicking opens an anchored editorial note).
 */
export function OfficialText({ html, statutoryTerms = [], wikiUrl, title }: { html: string; statutoryTerms?: StatutoryTerm[]; wikiUrl?: string; title?: number }) {
  const [active, setActive] = useState<TermCardState | null>(null);
  const [card, setCard] = useState<CardState | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const definition = active ? TERM_DEFINITIONS.find((entry) => entry.term.toLowerCase() === active.term.toLowerCase()) ?? null : null;
  const cardTerm = card ? statutoryTerms.find((term) => term.id === card.termId) ?? null : null;

  function place(target: HTMLElement): { top: number; left: number } {
    const wrap = wrapRef.current!;
    const wrapRect = wrap.getBoundingClientRect();
    const rect = target.getBoundingClientRect();
    return {
      top: rect.bottom - wrapRect.top + 4,
      left: Math.max(0, Math.min(rect.left - wrapRect.left, wrap.clientWidth - 348)),
    };
  }

  const defTarget = (node: EventTarget | null) => (node as HTMLElement | null)?.closest?.("[data-def]") as HTMLElement | null;

  function cancelHide() {
    if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; }
  }

  function scheduleHide() {
    cancelHide();
    hideTimer.current = setTimeout(() => setCard((now) => (now?.pinned ? now : null)), 150);
  }

  function toggleCard(target: HTMLElement) {
    const termId = Number(target.getAttribute("data-def"));
    setCard((now) => (now?.pinned && now.termId === termId ? null : { termId, ...place(target), pinned: true }));
  }

  function onClick(event: React.MouseEvent) {
    const starred = defTarget(event.target);
    if (starred) { toggleCard(starred); return; }
    setCard(null);
    const dotted = (event.target as HTMLElement | null)?.closest?.("[data-term]");
    if (dotted) {
      const term = dotted.getAttribute("data-term");
      if (term) setActive((now) => (now?.term === term ? null : { term, ...place(dotted as HTMLElement) }));
    }
  }

  function onMouseOver(event: React.MouseEvent) {
    const starred = defTarget(event.target);
    if (!starred) return;
    cancelHide();
    const termId = Number(starred.getAttribute("data-def"));
    setCard((now) => (now?.pinned ? now : { termId, ...place(starred), pinned: false }));
  }

  function onMouseOut(event: React.MouseEvent) {
    if (defTarget(event.target)) scheduleHide();
  }

  // The markers carry role="button" tabindex="0" — honor keyboard activation too.
  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") { setCard(null); return; }
    if (event.key !== "Enter" && event.key !== " ") return;
    const target = event.target as HTMLElement;
    const starred = defTarget(target);
    if (starred) { toggleCard(starred); event.preventDefault(); return; }
    if (target.closest?.("[data-term]")) { onClick(event as unknown as React.MouseEvent); event.preventDefault(); }
  }

  return <div ref={wrapRef} className={styles.officialWrap}>
    <div className={styles.officialBody} data-testid="official-text" onClick={onClick} onKeyDown={onKeyDown} onMouseOver={onMouseOver} onMouseOut={onMouseOut} dangerouslySetInnerHTML={{ __html: html }} />
    {card && cardTerm && <aside className={styles.defCard} style={{ top: card.top, left: card.left }} data-testid="definition-card" role="note" onMouseEnter={cancelHide} onMouseLeave={scheduleHide}>
      <p className={styles.defCardTitle}><b>“{cardTerm.term}”</b></p>
      <p className={styles.defCardSource}>defined in <Link href={cardTerm.url}>{cardTerm.citation}{cardTerm.heading ? ` — ${cardTerm.heading}` : ""}</Link></p>
      <p className={styles.defCardBody}><CitationText title={title}>{cardTerm.definition}</CitationText></p>
      <p className={styles.defCardScope}>{SCOPE_PHRASES[cardTerm.scopeType] ?? "the definition states its own reach"}</p>
      <p className={styles.defCardLinks}>
        <Link href={cardTerm.url}>read the defining section</Link>
        {wikiUrl && <Link href={wikiUrl}>all defined terms in this title</Link>}
        {card.pinned && <button className={styles.linkButton} onClick={() => setCard(null)}>close</button>}
      </p>
    </aside>}
    {definition && active && <aside className={`${styles.defCard} ${styles.termDef}`} style={{ top: active.top, left: active.left }} data-testid="term-definition" role="note" aria-live="polite">
      <b>“{definition.term}”</b>
      <p><CitationText title={title}>{definition.definition}</CitationText></p>
      <button className={styles.linkButton} onClick={() => setActive(null)}>close</button>
    </aside>}
  </div>;
}
