import { cookies } from "next/headers";
import { hashValue } from "@/lib/security";

/** Voter hash of the current viewer, for server components (null before the proxy sets the cookie). */
export async function viewerVoterHash(): Promise<string | null> {
  const cookie = (await cookies()).get("everylaw_voter")?.value;
  return cookie ? hashValue(cookie) : null;
}
