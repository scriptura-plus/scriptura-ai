import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Scriptura AI",
  description: "Read scripture with new eyes — AI-assisted Bible study.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
