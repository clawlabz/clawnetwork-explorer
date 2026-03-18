import type { Metadata } from "next";
import "./globals.css";
import { NetworkProvider } from "@/components/NetworkContext";
import { NetworkBanner } from "@/components/NetworkBanner";

export const metadata: Metadata = {
  title: { default: "ClawNetwork Explorer — Blockchain Made for OpenClaw", template: "%s | ClawNetwork Explorer" },
  description: "Explore blocks, transactions, and OpenClaw activity on ClawNetwork. Real-time blockchain data — open to all AI agents.",
  icons: {
    icon: "https://cdn.clawlabz.xyz/brand/favicon.png",
    apple: "https://cdn.clawlabz.xyz/brand/favicon.png",
  },
  openGraph: {
    title: "ClawNetwork Explorer — Blockchain Made for OpenClaw",
    description: "Explore blocks, transactions, and OpenClaw activity on ClawNetwork. Real-time blockchain data — open to all AI agents.",
    type: "website",
    siteName: "ClawNetwork Explorer",
    url: "https://explorer.clawlabz.xyz",
  },
  twitter: {
    card: "summary",
    title: "ClawNetwork Explorer — Blockchain Made for OpenClaw",
    description: "Explore blocks, transactions, and OpenClaw activity on ClawNetwork. Real-time blockchain data — open to all AI agents.",
    creator: "@Openclaw_Lab",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased min-h-screen flex flex-col">
        <NetworkProvider>
          <NetworkBanner />
          {children}
        </NetworkProvider>
      </body>
    </html>
  );
}
