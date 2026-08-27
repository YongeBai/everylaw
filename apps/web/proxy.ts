import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  if (!request.cookies.has("everylaw_voter")) {
    response.cookies.set("everylaw_voter", crypto.randomUUID(), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365 * 5,
      path: "/",
    });
  }
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
