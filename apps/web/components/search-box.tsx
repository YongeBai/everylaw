"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Suggestion = { citation: string; heading: string; url: string };

export function SearchBox({ large = false }: { large?: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<{ query: string; items: Suggestion[] }>({ query: "", items: [] });
  useEffect(() => {
    if (query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
      if (response.ok) setResult({ query, items: (await response.json()).results });
    }, 150);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);
  const items = result.query === query && query.trim().length >= 2 ? result.items : [];

  return <div className="relative w-full">
    <form onSubmit={(event) => { event.preventDefault(); if (query.trim()) router.push(`/search?q=${encodeURIComponent(query)}`); }}>
      <label className="sr-only" htmlFor={large ? "hero-search" : "search"}>Search the U.S. Code</label>
      <div className="flex rounded-full border-2 border-[#13241d] bg-white overflow-hidden shadow-[0_7px_0_rgba(19,36,29,.16)]">
        <input id={large ? "hero-search" : "search"} data-testid="search-input" value={query} onChange={(e) => setQuery(e.target.value)}
          className={`${large ? "px-6 py-4 text-lg" : "px-4 py-3"} min-w-0 grow outline-none`} placeholder="Try ‘margarine’, ‘flag’, or 18 USC 1111" autoComplete="off" />
        <button className="px-5 font-black bg-[#13241d] text-white" type="submit">Search</button>
      </div>
    </form>
    {items.length > 0 && <div data-testid="search-suggestions" className="absolute top-full mt-3 left-0 right-0 paper-card rounded-2xl overflow-hidden z-30">
      {items.map((item) => <button key={item.url} onClick={() => router.push(item.url)} className="block w-full text-left px-5 py-3 border-b border-[#e3d8c5] last:border-0 hover:bg-[#fff7e8]">
        <span className="font-black">{item.citation}</span><span className="text-[#68736d]"> — {item.heading}</span>
      </button>)}
    </div>}
  </div>;
}
