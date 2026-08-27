import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";

const secret = process.env.VOTER_HASH_SECRET ?? process.env.VOTE_HASH_SECRET;
if (!secret) throw new Error("VOTER_HASH_SECRET (or legacy VOTE_HASH_SECRET) is required");

export function hashValue(value: string) { return createHash("sha256").update(`${value}:${secret}`).digest("hex"); }

export function requestIdentity(request: NextRequest) {
  const cookie = request.cookies.get("everylaw_voter")?.value;
  if (!cookie) throw new Error("Load a page before interacting");
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
  return { voterHash: hashValue(cookie), ipHash: hashValue(ip), userAgentHash: hashValue(request.headers.get("user-agent") || "unknown") };
}

export function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return process.env.NODE_ENV !== "production";
  return origin === request.nextUrl.origin;
}

export function isAdmin(request: NextRequest) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return false;
  if (request.headers.get("x-admin-password") === password) return true;
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Basic ")) return false;
  const decoded = Buffer.from(auth.slice(6), "base64").toString();
  return decoded.split(":").at(-1) === password;
}
