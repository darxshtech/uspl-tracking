import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const isAuthPage = req.nextUrl.pathname.startsWith("/login");

    if (isAuthPage && token) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  },
  {
    pages: {
      signIn: "/login",
    },
    callbacks: {
      authorized: ({ token, req }) => {
        if (req.nextUrl.pathname.startsWith("/login")) {
          return true;
        }
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
