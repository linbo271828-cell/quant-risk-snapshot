import { getServerSession, type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GitHubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";
import { compare } from "bcryptjs";
import { db } from "./db";

const hasGitHub = Boolean(process.env.GITHUB_ID && process.env.GITHUB_SECRET);
const hasGoogle = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Username and password",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const username = credentials?.username?.trim().toLowerCase();
        const password = credentials?.password;
        // #region agent log
        fetch("http://127.0.0.1:7242/ingest/540f29d3-b53c-4854-a947-0acc20fc668e",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({runId:"credentials-authorize",hypothesisId:"H1",location:"lib/auth.ts:authorize:start",message:"Credentials authorize start",data:{hasUsername:Boolean(username),passwordLength:typeof password === "string" ? password.length : 0},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        if (!username || !password) return null;

        const user = await db.user.findUnique({ where: { username } });
        // #region agent log
        fetch("http://127.0.0.1:7242/ingest/540f29d3-b53c-4854-a947-0acc20fc668e",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({runId:"credentials-authorize",hypothesisId:"H3",location:"lib/auth.ts:authorize:userLookup",message:"Credentials user lookup finished",data:{foundUser:Boolean(user)},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        if (!user) return null;

        const isValid = await compare(password, user.passwordHash);
        // #region agent log
        fetch("http://127.0.0.1:7242/ingest/540f29d3-b53c-4854-a947-0acc20fc668e",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({runId:"credentials-authorize",hypothesisId:"H4",location:"lib/auth.ts:authorize:compare",message:"Credentials password compare result",data:{isValid},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        if (!isValid) return null;

        return { id: user.id, name: user.username };
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
  secret: process.env.NEXTAUTH_SECRET,
};

export async function getSession() {
  return getServerSession(authOptions);
}
