"use client";

import { useState } from "react";

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return <button
    data-testid="copy-button"
    className="button"
    onClick={async () => { try { await navigator.clipboard.writeText(text); setCopied(true); } catch { /* clipboard unavailable */ } }}
  >{copied ? "Copied — paste it anywhere" : label}</button>;
}
