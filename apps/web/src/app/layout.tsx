import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { getClerkPublishableKey, isClerkMode } from "@/lib/auth-mode";
import "./globals.css";

export const metadata: Metadata = {
  title: "LeadGen",
  description: "Go-to-market intelligence engine for account discovery and watchlist monitoring.",
  applicationName: "LeadGen",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const content = (
    <html lang="en">
      <body>{children}</body>
    </html>
  );

  if (!isClerkMode()) {
    return content;
  }

  return (
    <ClerkProvider publishableKey={getClerkPublishableKey()}>
      {content}
    </ClerkProvider>
  );
}
