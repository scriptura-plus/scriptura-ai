import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Scriptura Moderator",
  description: "Moderator workspace for Scriptura AI.",
  manifest: "/manifest-studio.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Moderator",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
