"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { FaAws } from "react-icons/fa";
import { AlertCircle, Loader2 } from "lucide-react";
import { useState } from "react";

// 错误消息映射
const errorMessages: Record<string, string> = {
  OAuthAccountNotLinked: "此邮箱已被其他登录方式使用。请使用原来的登录方式，或联系管理员。",
  OAuthSignin: "OAuth 登录初始化失败。请稍后重试。",
  OAuthCallback: "OAuth 回调处理失败。请检查 Cognito 配置。",
  OAuthCreateAccount: "创建账户失败。请稍后重试。",
  Callback: "认证回调错误。请检查回调 URL 配置。",
  AccessDenied: "访问被拒绝。您可能没有权限登录此应用。",
  Verification: "验证链接已过期或无效。",
  Default: "认证过程中发生错误。请稍后重试。",
};

export default function SignIn() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const error = searchParams.get("error");
  const [isLoading, setIsLoading] = useState(false);

  const errorMessage = error ? (errorMessages[error] || errorMessages.Default) : null;

  const handleSignIn = async (provider: string) => {
    try {
      setIsLoading(true);
      await signIn(provider, {
        callbackUrl,
        redirect: true
      });
    } catch (error) {
      console.error("Sign in failed:", error);
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-slate-900 px-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">欢迎回来</CardTitle>
          <CardDescription>登录您的账户以继续</CardDescription>
        </CardHeader>

        <CardContent className="grid gap-4">
          {errorMessage && (
            <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
              <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium">登录失败</p>
                <p className="text-sm opacity-90">{errorMessage}</p>
                {error && (
                  <p className="text-xs opacity-70 font-mono mt-2">
                    错误代码: {error}
                  </p>
                )}
              </div>
            </div>
          )}

          <Button
            variant="outline"
            className="flex items-center justify-center gap-2 h-11"
            onClick={() => handleSignIn("cognito")}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FaAws className="h-4 w-4" />
            )}
            {isLoading ? "正在登录..." : "使用 AWS Cognito 登录"}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                企业 SSO
              </span>
            </div>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            如果您的组织配置了 SSO，点击上方按钮将自动跳转到您的身份提供商。
          </p>
        </CardContent>

        <CardFooter className="flex flex-col items-center justify-center gap-2">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            登录即表示您同意我们的服务条款和隐私政策。
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
