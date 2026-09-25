import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { isAllowedEmail } from "@/lib/allowlist";

/**
 * Google sign-in (Auth.js). Reads AUTH_SECRET, AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET.
 * Optionally restrict who may sign in with AUTH_ALLOWED_EMAILS: a comma-separated
 * list of addresses and/or "@domain" entries.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt" },
  callbacks: {
    signIn({ profile }) {
      if (!profile?.email || profile.email_verified === false) return false;
      return isAllowedEmail(profile.email, process.env.AUTH_ALLOWED_EMAILS);
    },
    jwt({ token, profile }) {
      // Google's stable subject id identifies the user for quotas.
      if (profile?.sub) token.sub = profile.sub;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
