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
import { RecentAgentSessions } from "./RecentAgentSessions";
import {
  LogOut,
  Settings,
  User,
  FileText,
  Moon,
  Sun,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useParams, useRouter, usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";

export function GlobalSidebar() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const presentationId = params.id as string | undefined;
  const [isCollapsed, setIsCollapsed] = useState(false);

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
    <aside className={`border-r bg-gradient-to-b from-card to-card/50 flex flex-col h-screen shadow-sm transition-all duration-300 ${isCollapsed ? 'w-16' : 'w-64'}`}>
      {/* Top Section - Brand */}
      <div className="p-6 border-b">
        <Button
          variant="ghost"
          className={`w-full h-auto py-3 hover:bg-primary/5 ${isCollapsed ? 'justify-center px-0' : 'justify-start gap-3'}`}
          onClick={() => router.push("/")}
        >
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-pink-500">
            <FileText className="h-4 w-4 text-white" />
          </div>
          {!isCollapsed && <span className="font-bold text-lg">SlideForge</span>}
        </Button>
      </div>

      {/* Navigation Section */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-6">
          {/* Actions */}
          <div className="space-y-1">
            {!isCollapsed && (
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-3">
                Actions
              </p>
            )}

            <Button
              variant="ghost"
              className={`w-full h-10 ${isCollapsed ? 'justify-center px-0' : 'justify-start gap-3'}`}
              onClick={() => router.push("/")}
              title={isCollapsed ? "New Presentation" : undefined}
            >
              <FileText className="h-4 w-4" />
              {!isCollapsed && "New Presentation"}
            </Button>

            <Button
              variant="ghost"
              className={`w-full h-10 ${isCollapsed ? 'justify-center px-0' : 'justify-start gap-3'}`}
              onClick={() => router.push("/presentation/agent")}
              title={isCollapsed ? "Claude Agent" : undefined}
            >
              <Sparkles className="h-4 w-4" />
              {!isCollapsed && (
                <>
                  <span className="flex-1 text-left">Claude Agent</span>
                  <span className="text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 px-1.5 py-0.5 rounded-full font-medium">
                    Beta
                  </span>
                </>
              )}
            </Button>

            {/* Export Button - Only show when viewing a presentation */}
            {presentationId && !isCollapsed && (
              <ExportButton
                presentationId={presentationId}
                fileName={session?.user?.name || "presentation"}
              />
            )}
          </div>

          {!isCollapsed && <Separator />}
        </div>

        {/* Recent Presentations - Only show when expanded */}
        {!isCollapsed && <RecentPresentationsSidebar />}

        {/* Recent Agent Sessions - Only show when expanded */}
        {!isCollapsed && <RecentAgentSessions />}
      </div>

      {/* Bottom Section - Theme Toggle & User Profile */}
      <div className="p-4 border-t space-y-3">
        {/* Theme Toggle & Collapse Button */}
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="h-8 w-8"
            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDark ? (
              <Sun className="h-3.5 w-3.5" />
            ) : (
              <Moon className="h-3.5 w-3.5" />
            )}
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="h-8 w-8"
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <ChevronLeft className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>

        {session?.user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className={`w-full h-auto py-3 ${isCollapsed ? 'justify-center px-0' : 'justify-start gap-3 px-3'}`}
              >
                <Avatar className="h-9 w-9">
                  <AvatarImage src={session.user?.image || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                {!isCollapsed && (
                  <div className="flex-1 text-left overflow-hidden">
                    <p className="font-medium text-sm truncate">
                      {session.user?.name || "User"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {session.user?.email}
                    </p>
                  </div>
                )}
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
