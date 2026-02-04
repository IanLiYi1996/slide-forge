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
import { RecentPresentationsSidebar } from "./RecentPresentationsSidebar";
import { RecentAgentSessions } from "./RecentAgentSessions";
import { RecentDocumentSessions } from "./RecentDocumentSessions";
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
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useParams, useRouter, usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Separator } from "@/components/ui/separator";
import { useState, useEffect, useRef } from "react";

export function GlobalSidebar() {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);

  // 拖动相关的状态
  const [position, setPosition] = useState({ x: 24, y: 24 }); // 默认位置 (left-6, top-6)
  const [isDragging, setIsDragging] = useState(false);
  const [hasMoved, setHasMoved] = useState(false); // 跟踪是否真的移动了
  const dragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number } | null>(null);

  // 确保只在客户端渲染主题相关内容（避免 SSR hydration 错误）
  useEffect(() => {
    setMounted(true);

    // 从 localStorage 加载按钮位置
    const savedPosition = localStorage.getItem('sidebar-button-position');
    if (savedPosition) {
      try {
        const parsed = JSON.parse(savedPosition);
        // ✨ 验证位置是否在屏幕范围内
        const maxX = window.innerWidth - 48;
        const maxY = window.innerHeight - 48;
        const clampedX = Math.max(0, Math.min(parsed.x, maxX));
        const clampedY = Math.max(0, Math.min(parsed.y, maxY));
        setPosition({ x: clampedX, y: clampedY });
      } catch (e) {
        console.error('Failed to parse saved position:', e);
      }
    }
  }, []);

  // Debug session data - 必须在所有hooks之后，条件判断之前
  useEffect(() => {
    if (session?.user && process.env.NODE_ENV === "development") {
      console.log("[GlobalSidebar] Session user:", {
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
      });
    }
  }, [session]);

  // ✨ 键盘快捷键：Shift + R 重置按钮位置
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        const resetPosition = { x: 24, y: 24 };
        setPosition(resetPosition);
        localStorage.setItem('sidebar-button-position', JSON.stringify(resetPosition));
        console.log('[GlobalSidebar] Button position reset to default (24, 24)');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 拖动处理函数
  const handleMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
    // 左键点击才触发拖动
    if (e.button !== 0) return;

    e.preventDefault();
    setIsDragging(true);
    setHasMoved(false); // 重置移动标志

    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: position.x,
      initialY: position.y,
    };
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return;

      const deltaX = e.clientX - dragRef.current.startX;
      const deltaY = e.clientY - dragRef.current.startY;

      // 如果移动超过 5px，认为是拖动而不是点击
      if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
        setHasMoved(true);
      }

      const newX = dragRef.current.initialX + deltaX;
      const newY = dragRef.current.initialY + deltaY;

      // 限制在视口范围内（留出按钮的大小：48px）
      const maxX = window.innerWidth - 48;
      const maxY = window.innerHeight - 48;

      const clampedX = Math.max(0, Math.min(newX, maxX));
      const clampedY = Math.max(0, Math.min(newY, maxY));

      setPosition({ x: clampedX, y: clampedY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);

      // 保存位置到 localStorage
      if (hasMoved) {
        localStorage.setItem('sidebar-button-position', JSON.stringify(position));
      }

      dragRef.current = null;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, position, hasMoved]);

  // ✨ 只在 auth 页面和纯 ID 的 presentation 查看页面隐藏侧边栏
  if (
    pathname?.startsWith("/auth") ||
    (pathname?.match(/^\/presentation\/[a-f0-9-]{36}$/) && !pathname?.includes("/agent"))
  ) {
    return null;
  }

  // ✨ 所有页面都使用浮动按钮 + overlay 模式（统一为首页样式）
  if (!isOverlayOpen) {
    return (
      <button
        onMouseDown={handleMouseDown}
        onClick={(e) => {
          // 只有在没有拖动时才打开侧边栏
          if (!hasMoved) {
            setIsOverlayOpen(true);
          }
        }}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          cursor: isDragging ? 'grabbing' : 'grab',
        }}
        className="fixed z-[200] flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-pink-500 shadow-lg hover:shadow-xl hover:scale-105 transition-shadow duration-200 group select-none"
        title="Drag to move, Click to open menu"
        suppressHydrationWarning
      >
        <Sparkles className="h-5 w-5 text-white" />
      </button>
    );
  }

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

  // ✨ 统一使用 overlay 模式（所有页面都像首页）
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-in fade-in duration-200"
        onClick={() => setIsOverlayOpen(false)}
      />

      {/* Sidebar Drawer */}
      <aside className="fixed left-0 top-0 h-screen w-64 z-50 border-r bg-gradient-to-b from-card to-card/50 flex flex-col shadow-2xl animate-in slide-in-from-left duration-300">
        {/* Close Button */}
        <button
          onClick={() => setIsOverlayOpen(false)}
          className="absolute -right-10 top-6 flex items-center justify-center w-8 h-8 rounded-full bg-card border shadow-lg hover:bg-accent transition-colors"
          title="Close Menu"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {/* Sidebar content */}
        {renderSidebarContent(true)}
      </aside>
    </>
  );

  function renderSidebarContent(isOverlay = false) {
    return (
      <>
      {/* Top Section - Brand */}
      <div className="p-6 border-b">
        <Button
          variant="ghost"
          className={`w-full h-auto py-3 hover:bg-primary/5 ${isCollapsed ? 'justify-center px-0' : 'justify-start gap-3'}`}
          onClick={() => {
            if (isOverlay) {
              setIsOverlayOpen(false);
            }
            router.push("/");
          }}
        >
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-pink-500">
            <Sparkles className="h-4 w-4 text-white" />
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
          </div>
        </div>

        {/* Recent Presentations - Only show when expanded */}
        {!isCollapsed && <RecentPresentationsSidebar />}

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

                {/* Collapse Button - Hide in overlay mode */}
                {!isOverlay && (
                  <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="flex items-center justify-center h-9 w-9 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    title="Collapse Sidebar"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}

            {/* Collapse Button (when collapsed) - Hide in overlay mode */}
            {!isOverlay && isCollapsed && (
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

      </>
    );
  }
}
