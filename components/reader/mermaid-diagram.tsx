"use client";

import { useEffect, useId, useState } from "react";
import styles from "@/app/(reader)/reader.module.css";

/**
 * Client-side mermaid rendering for AI-explanation diagrams. The library is
 * loaded on demand so pages without a diagram ship none of it, and
 * securityLevel "strict" keeps diagram text sanitized. A diagram that fails
 * to parse degrades to its source shown as a plain code block.
 */
export function MermaidDiagram({ code }: { code: string }) {
  const id = useId();
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "neutral", fontFamily: "Verdana, Arial, Helvetica, sans-serif", flowchart: { useMaxWidth: true, padding: 8, nodeSpacing: 30, rankSpacing: 36 } });
        const rendered = await mermaid.render(`mmd${id.replace(/[^a-zA-Z0-9]/g, "")}`, code);
        if (!cancelled) setSvg(rendered.svg);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, [code, id]);

  if (failed || !svg) return <pre className={styles.mdCode} data-testid={failed ? "diagram-failed" : "diagram-loading"}>{code}</pre>;
  return <div className={styles.mdDiagram} role="img" dangerouslySetInnerHTML={{ __html: svg }} />;
}
