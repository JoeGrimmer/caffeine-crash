import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "caffeine-crash",
  description: "A playful calculator for coffee decisions and their consequences.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
