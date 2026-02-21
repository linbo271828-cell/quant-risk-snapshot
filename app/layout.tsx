import type { Metadata } from "next";
import SessionProvider from "../components/SessionProvider";
import SiteHeader from "../components/SiteHeader";
import "./globals.css";

export const metadata: Metadata = {
  title: "Quant Risk Snapshot",
  description: "Portfolio risk analytics and rebalancing dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>
          <SiteHeader />
          <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
        </SessionProvider>
      </body>
    </html>
  );
}
