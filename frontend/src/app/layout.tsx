import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LILA BLACK — Player Journey Explorer",
  description:
    "Explore human and bot player journeys, combat hotspots and traffic patterns across LILA BLACK's Ambrose Valley, Grand Rift and Lockdown maps.",
  applicationName: "LILA BLACK Player Journey Explorer",
  openGraph: {
    title: "LILA BLACK — Player Journey Explorer",
    description:
      "A level-design tool for replaying matches, comparing human and bot behaviour, and finding kill, death and traffic hotspots.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0c11",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">{children}</body>
    </html>
  );
}
