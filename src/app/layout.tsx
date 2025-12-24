import NextAuthProvider from "@/provider/NextAuthProvider";
import TanStackQueryProvider from "@/provider/TanstackProvider";
import { ThemeProvider } from "@/provider/theme-provider";
import { GlobalSidebar } from "@/components/layout/GlobalSidebar";
import "@/styles/globals.css";
import { type Metadata } from "next";
import { Inter } from "next/font/google";

// If loading a variable font, you don't need to specify the font weight
const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SlideForge - AI-Powered Presentation Generator",
  description: "Create stunning presentations with AI - Generate beautiful slides in seconds",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <TanStackQueryProvider>
      <NextAuthProvider>
        <html lang="en" suppressHydrationWarning>
          <body className={`${inter.className} antialiased`} suppressHydrationWarning>
            <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
              <div className="flex h-screen w-full">
                <GlobalSidebar />
                <main className="flex-1 overflow-auto">
                  {children}
                </main>
              </div>
            </ThemeProvider>
          </body>
        </html>
      </NextAuthProvider>
    </TanStackQueryProvider>
  );
}
