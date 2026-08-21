import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { AuthProvider } from "@/contexts/auth-context";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Linen RFID Dashboard",
  description: "Live inventory and theft-alert dashboard for the Linen RFID Detection System.",
};

// Sets the `dark` class on <html> before React hydrates, straight off
// localStorage (or the OS preference on a first visit) - without
// this, the page would always render light first, then flash to dark
// a moment later for anyone who'd switched it on. Kept inline (not a
// separate script file) so it runs synchronously, before the rest of
// <body> paints. Matches the storage key/logic in hooks/use-theme.ts.
const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem('linen-rfid-theme');var d=s?s==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      // The script below adds the `dark` class client-side, before
      // hydration - which never matches what the server rendered.
      // This is exactly what suppressHydrationWarning is for: it
      // tells React that one specific mismatch (this element's class
      // attribute) is expected, without silencing any others.
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
