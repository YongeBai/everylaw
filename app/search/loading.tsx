// Route-level pending UI: shown instantly on navigation while the
// server-rendered search results are being fetched. Deliberately
// self-contained (no shared-module imports) so it renders under any
// layout state.
export default function SearchLoading() {
  return (
    <div style={{ padding: "40px 16px", textAlign: "center", color: "var(--muted, #818384)", fontSize: 13 }}>
      <p aria-live="polite">searching every section of the U.S. Code…</p>
    </div>
  );
}
