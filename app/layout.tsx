import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "caffeine-crash",
  description: "A playful calculator for coffee decisions and their consequences.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <div className="app-root">{children}</div>
        <Analytics />
      </body>
    </html>
  );
}
