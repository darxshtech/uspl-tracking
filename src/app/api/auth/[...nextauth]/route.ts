import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

if (!process.env.NEXTAUTH_SECRET) {
  process.env.NEXTAUTH_SECRET = "i5pabR3XuHISkWjZyMeaOQnuzlJh94i0sQKWzSa+7GQ=";
}
if (!process.env.AUTH_SECRET) {
  process.env.AUTH_SECRET = process.env.NEXTAUTH_SECRET;
}

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
