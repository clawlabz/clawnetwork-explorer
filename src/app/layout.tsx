import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "ClawNetwork Explorer", template: "%s | ClawNetwork Explorer" },
  description: "Block explorer for ClawNetwork — the blockchain built for AI Agents.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased min-h-screen flex flex-col">
        <div className="bg-yellow-500/10 border-b border-yellow-500/30 text-center py-1.5">
          <span className="text-xs text-yellow-400 font-medium">
            ⚠ Testnet — This explorer is connected to ClawNetwork Testnet
          </span>
        </div>
        {children}
      </body>
    </html>
  );
}
