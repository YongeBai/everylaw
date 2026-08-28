import { ImageResponse } from "next/og";

/* Site-wide link preview, drawn as the interface itself: old-reddit chrome
   with the front page's promise. Per-law pages ship their own via /api/og. */

export const alt = "everylaw — the front page of the U.S. Code";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ROWS = [
  { rank: "1", score: "keep", title: "18 U.S.C. § 700 — Desecration of the flag of the United States", tagline: "submitted 58 years ago by Congress · 212 words" },
  { rank: "2", score: "477", title: "26 U.S.C. § 5001 — Imposition, rate, and attachment of tax", tagline: "submitted 86 years ago by Congress · 1,844 words" },
  { rank: "3", score: "?", title: "Every section of the U.S. Code is a post. Read it in plain English, then vote.", tagline: "keep or dissolve — make the strongest case either way" },
];

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", background: "#fff", color: "#000", display: "flex", flexDirection: "column", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", background: "#f0f0f0", borderBottom: "2px solid #d0d0d0", padding: "10px 28px", fontSize: 20, color: "#333", gap: 26 }}>
        <span style={{ fontWeight: 700 }}>ALL</span><span>crimes</span><span>food&drugs</span><span>taxes</span><span>telecom</span><span>commerce</span><span>health</span><span style={{ color: "#888" }}>browse all titles »</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 22, background: "#cee3f8", borderBottom: "2px solid #5f99cf", padding: "18px 28px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 62, height: 62, borderRadius: 62, background: "#ff4500", color: "#fff", fontSize: 40, fontWeight: 700 }}>§</div>
        <div style={{ display: "flex", fontSize: 46, fontWeight: 700 }}>everylaw</div>
        <div style={{ display: "flex", fontSize: 24, color: "#555" }}>the front page of the U.S. Code</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", padding: "26px 28px", gap: 8, flexGrow: 1 }}>
        {ROWS.map((row, index) => (
          <div key={row.rank} style={{ display: "flex", alignItems: "center", gap: 22, padding: "16px 10px", background: index === 1 ? "#f8f8f8" : "#fff" }}>
            <div style={{ display: "flex", color: "#c6c6c6", fontSize: 34, width: 40, justifyContent: "flex-end" }}>{row.rank}</div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 60 }}>
              <div style={{ display: "flex", color: "#ff4500", fontSize: 26 }}>▲</div>
              <div style={{ display: "flex", fontSize: 19, color: "#444", fontWeight: 700 }}>{row.score}</div>
              <div style={{ display: "flex", color: "#9494ff", fontSize: 26 }}>▼</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", fontSize: 30, color: "#0000c8" }}>{row.title}</div>
              <div style={{ display: "flex", fontSize: 19, color: "#888" }}>{row.tagline}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", padding: "14px 28px", borderTop: "2px solid #e0e0e0", color: "#888", fontSize: 19 }}>What should survive? · everylaw</div>
    </div>,
    size,
  );
}
