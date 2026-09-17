export const runtime = "nodejs";

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import type { JWT } from "next-auth/jwt";
import type { Session, User } from "next-auth";

const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  trustHost: true,
  pages: {
    signIn: "/login",
    signOut: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const parsed = z
          .object({ email: z.string().email(), password: z.string().min(8) })
          .safeParse(credentials);

        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        });

        if (!user) return null;

        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, role: user.role } as User & { role: string };
      },
    }),
  ],
  callbacks: {
    jwt: ({ token, user }) => {
      if (user) {
        const typedToken = token as JWT & { id: string; role: string };
        const typedUser = user as User & { role: string; id: string };
        typedToken.id = typedUser.id;
        typedToken.role = typedUser.role;
      }
      return token;
    },
    session: ({ session, token }) => {
      if (session.user) {
        const typedToken = token as JWT & { id: string; role: string };
        session.user.id = typedToken.id;
        session.user.role = typedToken.role || "admin";
      }
      return session;
    },
  },
  session: { strategy: "jwt" },
});

export const { GET, POST } = handlers;
export { signIn, signOut, auth };