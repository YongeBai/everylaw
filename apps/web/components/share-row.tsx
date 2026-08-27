"use client";
import { useState } from "react";

export function ShareRow({ citation, heading }: { citation: string; heading: string }) {
  const [message, setMessage] = useState("");
  async function share() {
    const data = { title: `${citation} — ${heading}`, text: `Should ${citation} survive?`, url: location.href };
    if (navigator.share) await navigator.share(data); else { await navigator.clipboard.writeText(location.href); setMessage("Link copied."); }
  }
  return <div className="flex flex-wrap gap-3 items-center"><button data-testid="share-law" onClick={share} className="button button-dark">Share this verdict</button><button onClick={async () => { await navigator.clipboard.writeText(location.href); setMessage("Link copied."); }} className="button">Copy link</button>{message && <span role="status" className="text-sm font-bold">{message}</span>}</div>;
}
