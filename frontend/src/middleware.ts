import { NextResponse, type NextRequest } from "next/server";

// Send anyone without a login cookie to /login. An expired cookie is cleared by the API (401),
// after which this check sends the user to /login as well.
export function middleware(req: NextRequest) {
  const loggedIn = req.cookies.has("gr_token");
  if (!loggedIn && !req.nextUrl.pathname.startsWith("/login")) {
    const url = new URL("/login", req.url);
    if (req.nextUrl.pathname !== "/") url.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!api|_next|favicon.ico).*)"] };
