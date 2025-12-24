"use client";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ExportButton } from "@/components/presentation/presentation-page/buttons/ExportButton";
import { RecentPresentationsSidebar } from "./RecentPresentationsSidebar";
import {
  LogOut,
  Settings,
  User,
  FileText,
  Moon,
  Sun,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useParams, useRouter, usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Separator } from "@/components/ui/separator";

export function GlobalSidebar() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const presentationId = params.id as string | undefined;

  // Hide sidebar on auth pages and presentation view pages
  if (pathname?.startsWith("/auth") || pathname?.match(/^\/presentation\/[^/]+$/)) {
    return null;
  }

  const userInitials = session?.user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "U";

  const isDark = theme === "dark";

  return (
    <aside className="w-64 border-r bg-gradient-to-b from-card to-card/50 flex flex-col h-screen shadow-sm">
      {/* Top Section - Brand */}
      <div className="p-6 border-b">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 h-auto py-3 hover:bg-primary/5"
          onClick={() => router.push("/")}
        >
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-pink-500">
            <FileText className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-lg">SlideForge</span>
        </Button>
      </div>

      {/* Navigation Section */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-6">
          {/* Actions */}
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-3">
              Actions
            </p>

            <Button
              variant="ghost"
              className="w-full justify-start gap-3 h-10"
              onClick={() => router.push("/")}
            >
              <FileText className="h-4 w-4" />
              New Presentation
            </Button>

            {/* Export Button - Only show when viewing a presentation */}
            {presentationId && (
              <ExportButton
                presentationId={presentationId}
                fileName={session?.user?.name || "presentation"}
              />
            )}
          </div>

          <Separator />

          {/* Appearance */}
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-3">
              Appearance
            </p>

            <Button
              variant="ghost"
              className="w-full justify-start gap-3 h-10"
              onClick={() => setTheme(isDark ? "light" : "dark")}
            >
              {isDark ? (
                <>
                  <Sun className="h-4 w-4" />
                  Light Mode
                </>
              ) : (
                <>
                  <Moon className="h-4 w-4" />
                  Dark Mode
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Recent Presentations */}
        <RecentPresentationsSidebar />
      </div>

      {/* Bottom Section - User Profile */}
      <div className="p-4 border-t">
        {session?.user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 h-auto py-3 px-3"
              >
                <Avatar className="h-9 w-9">
                  <AvatarImage src={session.user.image || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left overflow-hidden">
                  <p className="font-medium text-sm truncate">
                    {session.user.name || "User"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {session.user.email}
                  </p>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/settings")}>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => signOut({ callbackUrl: "/" })}
                className="text-red-600 focus:text-red-600"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => router.push("/auth/signin")}
          >
            <User className="h-4 w-4" />
            Sign In
          </Button>
        )}
      </div>
    </aside>
  );
}
