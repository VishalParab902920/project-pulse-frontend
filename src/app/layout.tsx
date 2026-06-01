import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import ErrorBoundary from "@/components/ErrorBoundary";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kayan-AI",
  description: "Your personal AI-powered fitness concierge. Track nutrition, log workouts, and get intelligent coaching, all through voice or text. Built for anyone ready to get fit.",
  metadataBase: new URL("https://kayan-fit.vercel.app"),
  themeColor: "#050505",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    title: "Kayan-AI",
    description: "Your personal AI-powered fitness concierge. Track nutrition, log workouts, and get intelligent coaching, all through voice or text. Built for anyone ready to get fit.",
    url: "https://kayan-fit.vercel.app",
    siteName: "Kayan",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Kayan — AI Fitness & Nutrition Companion",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kayan-AI",
    description: "Your personal AI-powered fitness concierge. Track nutrition, log workouts, and get intelligent coaching, all through voice or text.",
    images: ["/og-image.png"],
  },
};

export const viewport: Viewport = {
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full`}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        {/* Disable zoom only when running as installed PWA (standalone mode) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
                var meta = document.createElement('meta');
                meta.name = 'viewport';
                meta.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';
                document.head.appendChild(meta);
              }
            `,
          }}
        />
      </head>
      <body>
        <ErrorBoundary>{children}</ErrorBoundary>
      </body>
    </html>
  );
}
