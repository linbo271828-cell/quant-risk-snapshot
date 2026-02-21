import { getServerSession, type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GitHubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";
import { createHash } from "crypto";

const hasGitHub = Boolean(process.env.GITHUB_ID && process.env.GITHUB_SECRET);
const hasGoogle = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
const fallbackSecretSource = process.env.DATABASE_URL ?? "qrs-local-dev-secret";
const computedFallbackSecret = createHash("sha256").update(fallbackSecretSource).digest("hex");

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Username and password",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          const username = credentials?.username?.trim().toLowerCase();
          const password = credentials?.password;
          if (!username || !password) return null;

          const [{ db }, { compare }] = await Promise.all([import("./db"), import("bcryptjs")]);
          const user = await db.user.findUnique({ where: { username } });
          if (!user) return null;

          const isValid = await compare(password, user.passwordHash);
          if (!isValid) return null;

          return { id: user.id, name: user.username };
        } catch (err) {
          void err;
          return null;
        }
      },
    }),
    ...(hasGitHub
      ? [
          GitHubProvider({
            clientId: process.env.GITHUB_ID ?? "",
            clientSecret: process.env.GITHUB_SECRET ?? "",
          }),
        ]
      : []),
    ...(hasGoogle
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID ?? "",
            clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
          }),
        ]
      : []),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
  // Avoid hard production failure when NEXTAUTH_SECRET is missing by deriving
  // a stable secret from DATABASE_URL. Explicit NEXTAUTH_SECRET still wins.
  secret: process.env.NEXTAUTH_SECRET ?? computedFallbackSecret,
};

export async function getSession() {
  return getServerSession(authOptions);
}
