"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { CitationText } from "@/components/reader/citation-text";
import { TERM_DEFINITIONS } from "@/lib/terms";
import type { StatutoryTerm } from "@/components/reader/official-text";
import styles from "@/app/(reader)/reader.module.css";

const SCOPE_PHRASES: Record<string, string> = {
  title: "this definition applies throughout the title",
  part: "this definition applies throughout its part",
  chapter: "this definition applies throughout its chapter",
  subchapter: "this definition applies throughout its subchapter",
  subpart: "this definition applies throughout its subpart",
  division: "this definition applies throughout its division",
  section: "this definition applies in the defining section",
};

type CardState =
  | { kind: "statutory"; termId: number; top: number; left: number; pinned: boolean }
  | { kind: "curated"; term: string; top: number; left: number; pinned: boolean };

/**
 * Hover/click definition cards over any server-rendered children carrying
 * [data-def]/[data-term] markers — the translation pane's counterpart of the
 * interaction OfficialText provides for the official text.
 */
export function TermCards({ statutoryTerms = [], wikiUrl, title, children }: { statutoryTerms?: StatutoryTerm[]; wikiUrl?: string; title?: number; children: React.ReactNode }) {
  const [card, setCard] = useState<CardState | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const definition = card?.kind === "curated" ? TERM_DEFINITIONS.find((entry) => entry.term.toLowerCase() === card.term.toLowerCase()) ?? null : null;
  const cardTerm = card?.kind === "statutory" ? statutoryTerms.find((term) => term.id === card.termId) ?? null : null;

  function place(target: HTMLElement): { top: number; left: number } {
    const wrap = wrapRef.current!;
    const wrapRect = wrap.getBoundingClientRect();
    const rect = target.getBoundingClientRect();
    return {
      top: rect.bottom - wrapRect.top + 4,
      left: Math.max(0, Math.min(rect.left - wrapRect.left, wrap.clientWidth - 348)),
    };
  }

  const markerTarget = (node: EventTarget | null) => (node as HTMLElement | null)?.closest?.("[data-def], [data-term]") as HTMLElement | null;

  function cardFor(target: HTMLElement, pinned: boolean): CardState | null {
    const termId = target.getAttribute("data-def");
    if (termId) return { kind: "statutory", termId: Number(termId), ...place(target), pinned };
    const term = target.getAttribute("data-term");
    return term ? { kind: "curated", term, ...place(target), pinned } : null;
  }

  function isSameCard(left: CardState, right: CardState) {
    if (left.kind === "statutory") return right.kind === "statutory" && left.termId === right.termId;
    return right.kind === "curated" && left.term === right.term;
  }

  function cancelHide() {
    if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; }
  }

  function scheduleHide() {
    cancelHide();
    hideTimer.current = setTimeout(() => setCard((now) => (now?.pinned ? now : null)), 150);
  }

  function toggleCard(target: HTMLElement) {
    const next = cardFor(target, true);
    if (!next) return;
    setCard((now) => (now?.pinned && isSameCard(now, next) ? null : next));
  }

  function onClick(event: React.MouseEvent) {
    const marker = markerTarget(event.target);
    if (marker) { toggleCard(marker); return; }
    setCard(null);
  }

  function onMouseOver(event: React.MouseEvent) {
    const marker = markerTarget(event.target);
    if (!marker) return;
    cancelHide();
    setCard((now) => now?.pinned ? now : cardFor(marker, false));
  }

  function onMouseOut(event: React.MouseEvent) {
    if (markerTarget(event.target)) scheduleHide();
  }

  // The markers carry role="button" tabindex="0" — honor keyboard activation too.
  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") { setCard(null); return; }
    if (event.key !== "Enter" && event.key !== " ") return;
    const marker = markerTarget(event.target);
    if (marker) { toggleCard(marker); event.preventDefault(); }
  }

  return <div ref={wrapRef} className={styles.officialWrap} onClick={onClick} onKeyDown={onKeyDown} onMouseOver={onMouseOver} onMouseOut={onMouseOut}>
    {children}
    {card?.kind === "statutory" && cardTerm && <aside className={styles.defCard} style={{ top: card.top, left: card.left }} data-testid="definition-card" role="note" onMouseEnter={cancelHide} onMouseLeave={scheduleHide}>
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
    {card?.kind === "curated" && definition && <aside className={`${styles.defCard} ${styles.termDef}`} style={{ top: card.top, left: card.left }} data-testid="term-definition" role="note" aria-live="polite" onMouseEnter={cancelHide} onMouseLeave={scheduleHide}>
      <b>“{definition.term}”</b>
      <p><CitationText title={title}>{definition.definition}</CitationText></p>
      {card.pinned && <button className={styles.linkButton} onClick={() => setCard(null)}>close</button>}
    </aside>}
  </div>;
}
