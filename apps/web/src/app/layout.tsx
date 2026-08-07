import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CodersEye — Cross-Repo AI Code Review",
  description: "AI-powered code review with cross-repository awareness for GitHub PRs",
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
