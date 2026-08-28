import Link from "next/link";
import { sectionReferenceParts } from "@/lib/citations";

/** Plain text with every recognizable U.S. Code section reference linked internally. */
export function CitationText({ children, title }: { children: string; title?: number }) {
  return sectionReferenceParts(children, title).map((part, index) =>
    part.href ? <Link href={part.href} key={`${index}-${part.href}`}>{part.text}</Link> : part.text,
  );
}
