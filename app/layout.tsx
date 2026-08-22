import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";

import "./globals.css";

import { AppShell } from "@/components/shell/app-shell";
import { THEME_SCRIPT } from "@/components/shell/theme-toggle";
import { ToastProvider } from "@/components/ui/toast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * The editorial face, used only for long-form journal content. An optical size
 * range lets body text stay comfortable without the display weight bleeding
 * into the UI.
 */
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "My Amazon SDE Journey",
  description: "A personal record of the road to an Amazon SDE interview.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Warm paper in light, warm near-black in dark — matches --canvas so the
  // browser chrome does not flash white on mobile.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf8" },
    { media: "(prefers-color-scheme: dark)", color: "#14130f" },
  ],
};

/**
 * Render every page per request.
 *
 * Journal content is read straight off the filesystem, which Next cannot see
 * into — left to itself it prerenders pages at build time and then serves a
 * snapshot of an empty journal forever. Static output has no value for a
 * single-user app on localhost, and getting this wrong looks exactly like
 * "my entry didn't save".
 */
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} h-full`}
    >
      <head>
        {/* Applies the stored theme before first paint. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full">
        <a
          href="#content"
          className="sr-only-focusable bg-accent text-small text-accent-ink absolute top-2 left-2 z-50 rounded-md px-4 py-2"
        >
          Skip to content
        </a>

        <ToastProvider>
          <AppShell>{children}</AppShell>
        </ToastProvider>
      </body>
    </html>
  );
}
