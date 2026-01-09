"use client";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createPresentation } from "@/app/_actions/presentation/presentationActions";
import { createInitialCanvasData } from "@/states/prezi-editor-state";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RecentPresentationsSidebar } from "./RecentPresentationsSidebar";
import { RecentPreziSidebar } from "./RecentPreziSidebar";
import { RecentAgentSessions } from "./RecentAgentSessions";
import { RecentDocumentSessions } from "./RecentDocumentSessions";
import { CreatePreziDialog } from "@/components/presentation/prezi/CreatePreziDialog";
import { useToast } from "@/components/ui/use-toast";
import {
  LogOut,
  User,
  FileText,
  Moon,
  Sun,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Image,
  Key,
  BarChart3,
  Zap,
  Presentation as PresentationIcon,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useParams, useRouter, usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Separator } from "@/components/ui/separator";
import { useState, useEffect } from "react";

export function GlobalSidebar() {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // 确保只在客户端渲染主题相关内容（避免 SSR hydration 错误）
  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle create new Prezi (show dialog)
  const handleCreatePrezi = () => {
    setShowCreateDialog(true);
  };

  // Handle confirm create (from dialog)
  const handleConfirmCreate = async (data: { title: string; description?: string }) => {
    try {
      const newCanvasData = createInitialCanvasData();
      const result = await createPresentation({
        title: data.title,
        mode: "PREZI",
        content: newCanvasData as any,
        theme: "mystique",
        language: "en-US",
      });

      if (result.success && result.presentation) {
        // Navigate to the new Prezi editor
        router.push(`/presentation/prezi-edit/${result.presentation.id}`);
        toast({
          title: "Prezi Created",
          description: `"${data.title}" is ready to edit!`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to create Prezi presentation",
        });
      }
    } catch (error) {
      console.error("Create Prezi error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create Prezi presentation",
      });
    }
  };

  // Hide sidebar on auth pages and presentation view pages (but not agent pages)
  if (
    pathname?.startsWith("/auth") ||
    (pathname?.match(/^\/presentation\/[^/]+$/) && !pathname?.includes("/agent"))
  ) {
    return null;
  }

  // Debug session data
  useEffect(() => {
    if (session?.user && process.env.NODE_ENV === "development") {
      console.log("[GlobalSidebar] Session user:", {
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
      });
    }
  }, [session]);

  // Calculate user initials with better fallback
  const userName = session?.user?.name || session?.user?.email?.split("@")[0] || "User";
  const userInitials = session?.user?.name
    ? session.user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2) // Max 2 letters
    : session?.user?.email
    ? session.user.email[0]?.toUpperCase()
    : "U";

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
              onClick={() => router.push("/presentation")}
              title={isCollapsed ? "Image to Slides" : undefined}
            >
              <FileText className="h-4 w-4" />
              {!isCollapsed && "Image to Slides"}
            </Button>

            <Button
              variant="ghost"
              className={`w-full h-10 ${isCollapsed ? 'justify-center px-0' : 'justify-start gap-3'}`}
              onClick={() => router.push("/presentation/agent")}
              title={isCollapsed ? "Chat to Slides" : undefined}
            >
              <Sparkles className="h-4 w-4" />
              {!isCollapsed && (
                <>
                  <span className="flex-1 text-left">Chat to Slides</span>
                  <span className="text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 px-1.5 py-0.5 rounded-full font-medium">
                    AI
                  </span>
                </>
              )}
            </Button>

            <Button
              variant="ghost"
              className={`w-full h-10 ${isCollapsed ? 'justify-center px-0' : 'justify-start gap-3'}`}
              onClick={() => router.push("/document-processor")}
              title={isCollapsed ? "Document Processor" : undefined}
            >
              <Image className="h-4 w-4" />
              {!isCollapsed && "Document Processor"}
            </Button>

            <Button
              variant="ghost"
              className={`w-full h-10 ${isCollapsed ? 'justify-center px-0' : 'justify-start gap-3'}`}
              onClick={handleCreatePrezi}
              title={isCollapsed ? "Create Prezi" : undefined}
            >
              <PresentationIcon className="h-4 w-4" />
              {!isCollapsed && (
                <>
                  <span className="flex-1 text-left">Create Prezi</span>
                  <span className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 px-1.5 py-0.5 rounded-full font-medium">
                    NEW
                  </span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Recent Presentations - Only show when expanded */}
        {!isCollapsed && <RecentPresentationsSidebar />}

        {/* Recent Prezi - Only show when expanded */}
        {!isCollapsed && <RecentPreziSidebar />}

        {/* Recent Agent Sessions - Only show when expanded */}
        {!isCollapsed && <RecentAgentSessions />}

        {/* Recent Document Sessions - Only show when expanded */}
        {!isCollapsed && <RecentDocumentSessions />}
      </div>

      {/* Bottom Section - User Profile & Controls */}
      <div className="p-3 border-t bg-gradient-to-t from-muted/30 to-transparent">
        {session?.user ? (
          <div className="space-y-2">
            {/* User Profile Card */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className={`w-full h-auto py-2.5 hover:bg-accent/50 rounded-lg transition-all ${isCollapsed ? 'justify-center px-0' : 'justify-start gap-3 px-3'}`}
                >
                  <Avatar className="h-8 w-8 ring-2 ring-primary/20">
                    <AvatarImage src={session.user?.image || undefined} />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground font-semibold text-xs">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  {!isCollapsed && (
                    <div className="flex-1 text-left overflow-hidden">
                      <p className="font-semibold text-sm truncate">
                        {userName}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {session.user?.email || "No email"}
                      </p>
                    </div>
                  )}
                </Button>
              </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/settings/api-config")}>
                <Key className="mr-2 h-4 w-4" />
                API Configuration
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/settings/usage")}>
                <BarChart3 className="mr-2 h-4 w-4" />
                Usage Statistics
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/settings/quota")}>
                <Zap className="mr-2 h-4 w-4" />
                Quota Management
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

            {/* Quick Controls Bar */}
            {!isCollapsed && (
              <div className="flex items-center justify-between gap-2 px-1">
                {/* Theme Toggle */}
                <button
                  onClick={() => setTheme(isDark ? "light" : "dark")}
                  className="flex-1 flex items-center justify-center gap-2 h-9 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  title={mounted ? (isDark ? "Switch to Light Mode" : "Switch to Dark Mode") : "Toggle Theme"}
                  suppressHydrationWarning
                >
                  {mounted && (
                    <>
                      {isDark ? (
                        <Sun className="h-4 w-4 text-yellow-500" />
                      ) : (
                        <Moon className="h-4 w-4 text-blue-500" />
                      )}
                      <span className="text-xs font-medium">
                        {isDark ? "Light" : "Dark"}
                      </span>
                    </>
                  )}
                </button>

                {/* Collapse Button */}
                <button
                  onClick={() => setIsCollapsed(!isCollapsed)}
                  className="flex items-center justify-center h-9 w-9 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  title="Collapse Sidebar"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Collapse Button (when collapsed) */}
            {isCollapsed && (
              <button
                onClick={() => setIsCollapsed(false)}
                className="w-full flex items-center justify-center h-9 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                title="Expand Sidebar"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
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

      {/* Create Prezi Dialog */}
      <CreatePreziDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onConfirm={handleConfirmCreate}
      />
    </aside>
  );
}
