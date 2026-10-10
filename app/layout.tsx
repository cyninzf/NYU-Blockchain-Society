import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { homeTitle, siteDescription, siteName, siteUrl } from "@/content/site";
import "./globals.css";

import SiteAnalytics from "@/components/SiteAnalytics";
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: homeTitle, template: `%s · ${siteName}` },
  description: siteDescription,
  alternates: { canonical: "/" },
  // Images come from app/opengraph-image.tsx and app/twitter-image.tsx,
  // resolved to absolute URLs against metadataBase.
  openGraph: {
    type: "website",
    url: "/",
    siteName,
    title: homeTitle,
    description: siteDescription,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    site: "@NYU_Blockchain",
    title: homeTitle,
    description: siteDescription,
  },
  icons: { icon: "/brand/favicon.svg", apple: "/brand/favicon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1C0533",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body>{children}<SiteAnalytics /></body>
    </html>
  );
}
