import { env } from "@/env";
import { db } from "@/server/db";
import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth, { type DefaultSession, type Session } from "next-auth";
import { type Adapter } from "next-auth/adapters";
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
      // 首次登录时，从用户对象获取信息
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

      // OAuth 登录时，确保从数据库获取最新的用户信息
      if (account && token.email) {
        const dbUser = await db.user.findUnique({
          where: { email: token.email as string },
          select: { id: true, hasAccess: true, role: true, name: true, image: true },
        });
        if (dbUser) {
          token.id = dbUser.id;
          token.hasAccess = dbUser.hasAccess;
          token.role = dbUser.role;
          token.isAdmin = dbUser.role === "ADMIN";
          // 如果数据库中有更完整的信息，使用数据库中的
          if (dbUser.name) token.name = dbUser.name;
          if (dbUser.image) token.image = dbUser.image;
        }
      }

      // Handle session updates
      if (trigger === "update" && (session as Session)?.user) {
        const dbUser = await db.user.findUnique({
          where: { id: token.id as string },
        });
        if (session) {
          token.name = (session as Session).user.name;
          token.image = (session as Session).user.image;
          token.picture = (session as Session).user.image;
          token.location = (session as Session).user.location;
          token.role = (session as Session).user.role;
          token.isAdmin = (session as Session).user.role === "ADMIN";
        }
        if (dbUser) {
          token.hasAccess = dbUser.hasAccess ?? false;
          token.role = dbUser.role;
          token.isAdmin = dbUser.role === "ADMIN";
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

    async signIn({ user, account, profile }) {
      if (!user.email) {
        console.error("[Auth] Sign in failed: no email provided");
        return false;
      }

      try {
        // 检查用户是否已存在
        const existingUser = await db.user.findUnique({
          where: { email: user.email },
          include: { accounts: true },
        });

        if (existingUser) {
          // 用户存在，检查是否已关联此 provider 的账户
          const existingAccount = existingUser.accounts.find(
            (acc) => acc.provider === account?.provider
          );

          if (!existingAccount && account) {
            // 用户存在但没有此 provider 的账户，创建关联
            console.log(`[Auth] Linking ${account.provider} account to existing user: ${user.email}`);
            await db.account.create({
              data: {
                userId: existingUser.id,
                type: account.type,
                provider: account.provider,
                providerAccountId: account.providerAccountId,
                access_token: account.access_token,
                expires_at: account.expires_at,
                token_type: account.token_type,
                scope: account.scope,
                id_token: account.id_token,
                refresh_token: account.refresh_token,
              },
            });
          }

          // 更新用户 ID 以确保 JWT 使用正确的 ID
          user.id = existingUser.id;
          user.hasAccess = existingUser.hasAccess;
          user.role = existingUser.role;
        } else {
          // 新用户，设置默认值
          user.hasAccess = false;
          user.role = "USER";
        }

        return true;
      } catch (error) {
        console.error("[Auth] Sign in error:", error);
        return true; // 仍然允许登录，让 adapter 处理用户创建
      }
    },
  },

  adapter: PrismaAdapter(db) as Adapter,

  providers: [
    CognitoProvider({
      clientId: env.COGNITO_CLIENT_ID,
      clientSecret: env.COGNITO_CLIENT_SECRET,
      issuer: env.COGNITO_ISSUER,
      // 使用 'state' 检查以提高兼容性
      // 如果 Cognito 配置了 PKCE，可以改为 ['pkce', 'state']
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
    error: "/auth/signin", // 错误时重定向到登录页
  },
});
