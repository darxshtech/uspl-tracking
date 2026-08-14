import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import pool from "./db";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Missing email or password");
        }
        
        try {
          const [rows]: any = await pool.query(
            "SELECT id, name, email, password_hash, role, is_active FROM users WHERE email = ?",
            [credentials.email]
          );
          
          if (rows.length === 0) {
            throw new Error("Invalid credentials");
          }
          
          const user = rows[0];
          
          if (!user.is_active) {
            throw new Error("Account is inactive");
          }
          
          const isValid = await bcrypt.compare(credentials.password, user.password_hash);
          
          if (!isValid) {
            throw new Error("Invalid credentials");
          }
          
          return {
            id: user.id.toString(),
            name: user.name,
            email: user.email,
            role: user.role
          };
        } catch (error) {
          throw error;
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
      }
      return session;
    }
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
