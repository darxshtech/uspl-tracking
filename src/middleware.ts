import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

const FALLBACK_SECRET = "i5pabR3XuHISkWjZyMeaOQnuzlJh94i0sQKWzSa+7GQ=";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const isAuthPage = req.nextUrl.pathname.startsWith("/login");

    if (isAuthPage && token) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  },
  {
    secret: process.env.NEXTAUTH_SECRET || FALLBACK_SECRET,
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
