import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BehaviorPrompt Games",
  description:
    "A research console for studying behavior-only prompting in game agents.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
