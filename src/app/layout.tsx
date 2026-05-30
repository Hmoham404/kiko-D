import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MYC Production Performance Dashboard",
  description: "Dashboard web professionnel pour le suivi de performance production MYC.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
