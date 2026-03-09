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
import type { JWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      hasAccess: boolean;
      location?: string;
      role: string;
      isAdmin: boolean;
    } & DefaultSession["user"];
    accessToken?: string;
    idToken?: string;
    error?: string;
  }

  interface User {
    hasAccess: boolean;
    role: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    idToken?: string;
    refreshToken?: string;
    expiresAt?: number;
    error?: "RefreshTokenError" | "TokenExpired";
  }
}

// Cache for the token endpoint URL
let cachedTokenEndpoint: string | null = null;

/**
 * Get the Cognito token endpoint by fetching the OIDC discovery document
 */
async function getTokenEndpoint(): Promise<string | null> {
  if (cachedTokenEndpoint) {
    return cachedTokenEndpoint;
  }

  try {
    const discoveryUrl = `${env.COGNITO_ISSUER}/.well-known/openid-configuration`;
    console.log("[Auth] Fetching OIDC discovery from:", discoveryUrl);

    const response = await fetch(discoveryUrl);
    if (!response.ok) {
      console.error("[Auth] Failed to fetch OIDC discovery:", response.status);
      return null;
    }

    const config = await response.json() as { token_endpoint?: string };
    cachedTokenEndpoint = config.token_endpoint ?? null;

    console.log("[Auth] Token endpoint discovered:", cachedTokenEndpoint);
    return cachedTokenEndpoint;
  } catch (error) {
    console.error("[Auth] Error fetching OIDC discovery:", error);
    return null;
  }
}

/**
 * Refresh Cognito tokens using the refresh_token grant
 *
 * Uses the OIDC discovery document to find the token endpoint,
 * which handles different Cognito configurations (hosted domain, custom domain, etc.)
 *
 * @param refreshToken - The Cognito refresh token
 * @returns New token set or null if refresh failed
 */
async function refreshCognitoTokens(refreshToken: string): Promise<{
  access_token: string;
  id_token: string;
  expires_at: number;
} | null> {
  try {
    const tokenEndpoint = await getTokenEndpoint();

    if (!tokenEndpoint) {
      console.error("[Auth] Could not determine token endpoint");
      return null;
    }

    console.log("[Auth] Refreshing Cognito tokens...");

    const response = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: env.COGNITO_CLIENT_ID,
        client_secret: env.COGNITO_CLIENT_SECRET,
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Auth] Token refresh failed:", response.status, errorText);
      return null;
    }

    const tokens = await response.json() as {
      access_token: string;
      id_token: string;
      expires_in: number;
      token_type: string;
    };

    console.log("[Auth] Token refresh successful");

    return {
      access_token: tokens.access_token,
      id_token: tokens.id_token,
      // expires_in is in seconds, convert to Unix timestamp
      expires_at: Math.floor(Date.now() / 1000) + tokens.expires_in,
    };
  } catch (error) {
    console.error("[Auth] Token refresh error:", error);
    return null;
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

      // OAuth login: store tokens and get latest user info from S3
      if (account && token.id) {
        // Store Cognito tokens for AgentCore
        token.accessToken = account.access_token;
        token.idToken = account.id_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;

        try {
          const profile = await getUserProfile(token.id as string);
          if (profile) {
            token.hasAccess = profile.hasAccess;
            token.role = profile.role;
            token.isAdmin = profile.role === "ADMIN";
            if (profile.name) token.name = profile.name;
            if (profile.image) token.image = profile.image;
          }
        } catch (error) {
          console.error("[Auth] Failed to fetch user profile in jwt callback:", error);
        }
      }

      // Handle session updates
      if (trigger === "update" && (session as Session)?.user) {
        let profile: UserProfile | null = null;
        try {
          profile = await getUserProfile(token.id as string);
        } catch (error) {
          console.error("[Auth] Failed to fetch user profile during session update:", error);
        }
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

      // Check if token needs refresh (refresh 60 seconds before expiry for safety)
      const tokenExpiresAt = token.expiresAt as number | undefined;
      const bufferSeconds = 60;
      const shouldRefresh = tokenExpiresAt && Date.now() >= (tokenExpiresAt - bufferSeconds) * 1000;

      if (shouldRefresh && token.refreshToken) {
        console.log("[Auth] Access token expired or expiring soon, attempting refresh...");

        const refreshedTokens = await refreshCognitoTokens(token.refreshToken as string);

        if (refreshedTokens) {
          // Update token with new values
          token.accessToken = refreshedTokens.access_token;
          token.idToken = refreshedTokens.id_token;
          token.expiresAt = refreshedTokens.expires_at;
          token.error = undefined; // Clear any previous error
          console.log("[Auth] Token refreshed successfully, new expiry:", new Date(refreshedTokens.expires_at * 1000).toISOString());
        } else {
          // Refresh failed - user needs to re-authenticate
          console.error("[Auth] Token refresh failed, user must re-authenticate");
          token.error = "RefreshTokenError";
        }
      } else if (shouldRefresh && !token.refreshToken) {
        // No refresh token available
        console.error("[Auth] Token expired but no refresh token available");
        token.error = "TokenExpired";
      }

      return token;
    },

    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.hasAccess = (token.hasAccess as boolean) ?? false;
      session.user.location = token.location as string;
      session.user.role = (token.role as string) ?? "USER";
      session.user.isAdmin = token.role === "ADMIN";

      // Expose tokens for AgentCore API calls
      // Use idToken for AgentCore JWT auth (contains user claims)
      session.accessToken = token.accessToken as string | undefined;
      session.idToken = token.idToken as string | undefined;
      session.error = token.error as string | undefined;

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
