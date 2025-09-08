import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Add COOP header to most app responses.
// We intentionally do NOT set COEP globally to avoid blocking third-party assets.
export function middleware(_req: NextRequest) {
  const res = NextResponse.next();
  res.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  return res;
}

// Skip static assets & the Next image optimizer
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
