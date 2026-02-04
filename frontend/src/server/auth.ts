import { env } from "@/env";
import {
  getUserProfile,
  createUserProfile,
  addAccount,
  getAccountByProvider,
  type UserProfile,
} from "@/services/s3/user-service";
import NextAuth, { type DefaultSession, type Session } from "next-auth";
import CognitoProvider from "next-auth/providers/cognito";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      hasAccess: boolean;
      location?: string;
      role: string;
      isAdmin: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    hasAccess: boolean;
    role: string;
  }
}

export const { auth, handlers, signIn, signOut } = NextAuth({
  trustHost: true,
  debug: process.env.NODE_ENV === "development",
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user, account, trigger, session }) {
      // First login: get info from user object
      if (user) {
        token.id = user.id;
        token.hasAccess = user.hasAccess ?? false;
        token.name = user.name;
        token.email = user.email;
        token.image = user.image;
        token.picture = user.image;
        token.location = (user as Session["user"]).location;
        token.role = user.role ?? "USER";
        token.isAdmin = user.role === "ADMIN";
      }

      // OAuth login: get latest user info from S3
      if (account && token.id) {
        const profile = await getUserProfile(token.id as string);
        if (profile) {
          token.hasAccess = profile.hasAccess;
          token.role = profile.role;
          token.isAdmin = profile.role === "ADMIN";
          if (profile.name) token.name = profile.name;
          if (profile.image) token.image = profile.image;
        }
      }

      // Handle session updates
      if (trigger === "update" && (session as Session)?.user) {
        const profile = await getUserProfile(token.id as string);
        if (session) {
          token.name = (session as Session).user.name;
          token.image = (session as Session).user.image;
          token.picture = (session as Session).user.image;
          token.location = (session as Session).user.location;
          token.role = (session as Session).user.role;
          token.isAdmin = (session as Session).user.role === "ADMIN";
        }
        if (profile) {
          token.hasAccess = profile.hasAccess ?? false;
          token.role = profile.role;
          token.isAdmin = profile.role === "ADMIN";
        }
      }

      return token;
    },

    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.hasAccess = (token.hasAccess as boolean) ?? false;
      session.user.location = token.location as string;
      session.user.role = (token.role as string) ?? "USER";
      session.user.isAdmin = token.role === "ADMIN";
      return session;
    },

    async signIn({ user, account, profile: oauthProfile }) {
      if (!user.email) {
        console.error("[Auth] Sign in failed: no email provided");
        return false;
      }

      // For Cognito, the user ID comes from the 'sub' claim
      // We use this as our primary user identifier
      const cognitoSub = account?.providerAccountId;
      if (!cognitoSub) {
        console.error("[Auth] Sign in failed: no Cognito sub");
        return false;
      }

      try {
        // Check if user profile exists in S3
        let existingProfile = await getUserProfile(cognitoSub);

        if (existingProfile) {
          // User exists - update user object with stored info
          user.id = existingProfile.id;
          user.hasAccess = existingProfile.hasAccess;
          user.role = existingProfile.role;

          // Check if this provider account is linked
          const existingAccount = await getAccountByProvider(cognitoSub, account.provider);
          if (!existingAccount) {
            // Link this provider account
            console.log(`[Auth] Linking ${account.provider} account to existing user: ${user.email}`);
            await addAccount(cognitoSub, {
              provider: account.provider,
              providerAccountId: account.providerAccountId,
              type: account.type,
              access_token: account.access_token ?? undefined,
              expires_at: account.expires_at ?? undefined,
              token_type: account.token_type ?? undefined,
              scope: account.scope ?? undefined,
              id_token: account.id_token ?? undefined,
              refresh_token: account.refresh_token ?? undefined,
            });
          }
        } else {
          // New user - create profile in S3
          console.log(`[Auth] Creating new user profile for: ${user.email}`);
          existingProfile = await createUserProfile({
            id: cognitoSub,
            email: user.email,
            name: user.name ?? oauthProfile?.name ?? undefined,
            image: user.image ?? undefined,
            role: "USER",
            hasAccess: false,
          });

          // Link the provider account
          await addAccount(cognitoSub, {
            provider: account.provider,
            providerAccountId: account.providerAccountId,
            type: account.type,
            access_token: account.access_token ?? undefined,
            expires_at: account.expires_at ?? undefined,
            token_type: account.token_type ?? undefined,
            scope: account.scope ?? undefined,
            id_token: account.id_token ?? undefined,
            refresh_token: account.refresh_token ?? undefined,
          });

          // Set defaults for new user
          user.id = cognitoSub;
          user.hasAccess = false;
          user.role = "USER";
        }

        return true;
      } catch (error) {
        console.error("[Auth] Sign in error:", error);
        // Still allow login even if S3 operations fail
        // This ensures users aren't locked out
        user.id = cognitoSub;
        user.hasAccess = false;
        user.role = "USER";
        return true;
      }
    },
  },

  // No adapter - we handle user persistence ourselves via S3
  // adapter: PrismaAdapter(db) as Adapter,

  providers: [
    CognitoProvider({
      clientId: env.COGNITO_CLIENT_ID,
      clientSecret: env.COGNITO_CLIENT_SECRET,
      issuer: env.COGNITO_ISSUER,
      // Use 'state' check for compatibility
      // If Cognito is configured with PKCE, change to ['pkce', 'state']
      checks: ["state"],
      authorization: {
        params: {
          scope: "openid email profile",
        },
      },
    }),
  ],

  pages: {
    signIn: "/auth/signin",
    error: "/auth/signin",
  },
});
