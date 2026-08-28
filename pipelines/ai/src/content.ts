export type ContentType = "summary" | "explanation" | "origin" | "facts";
export type LawInput = { citation: string; heading: string; bodyText: string; sourceCredit: string | null; enactingPl: string | null; enactedDate: string | null; wordCount: number; amendmentCount: number };

export function deterministicContent(type: ContentType, law: LawInput): string {
  if (type === "summary") return `This section sets federal rules concerning ${law.heading.toLowerCase()}. Read the official text for its exact scope and exceptions.`;
  if (type === "explanation") return `In plain English, ${law.citation} addresses ${law.heading.toLowerCase()}. The official text is the controlling source; this explanation summarizes its central rule without adding requirements or exceptions. It applies only in the federal contexts described by the section and related definitions. Anyone making a legal decision should read the full statute and get qualified advice.`;
  if (type === "origin") return law.enactingPl && law.enactedDate
    ? `The source credit connects this section to ${law.enactingPl} on ${law.enactedDate}. It lists ${law.amendmentCount} Public Law reference${law.amendmentCount === 1 ? "" : "s"}. The source credit alone does not establish Congress’s broader motive, so further primary-source research is needed before making a historical claim.`
    : "The supplied source credit does not provide enough grounded information to identify both the enacting law and date. Further primary-source research is needed before describing why Congress acted.";
  return `- Citation: ${law.citation}\n- The official text contains about ${law.wordCount} words.\n- Status and source-credit details should be checked against the current release point.\n- The source credit contains ${law.amendmentCount} Public Law reference${law.amendmentCount === 1 ? "" : "s"}.`;
}

export function lintContent(type: ContentType, body: string): string[] {
  const errors: string[] = [];
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  if (!body.trim()) errors.push("empty output");
  if (/\bas an ai\b/i.test(body)) errors.push("AI self-reference");
  if (/consult (a|your) lawyer/i.test(body) && type === "summary") errors.push("boilerplate in summary");
  if (type === "summary" && (body.length > 500 || words > 70)) errors.push("summary too long");
  if (type === "explanation" && words < 100) errors.push("explanation too short");
  if (type === "origin" && words > 260) errors.push("origin too long");
  if (type === "facts") {
    const bullets = body.split("\n").filter((line) => line.trimStart().startsWith("- ")).length;
    if (bullets < 3 || bullets > 5) errors.push("facts must contain 3–5 bullets");
  }
  return errors;
}
