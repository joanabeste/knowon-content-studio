import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KnowOn Content Studio",
  description: "Marketing-Content-Generator für KnowOn",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body
        className="min-h-screen bg-background antialiased"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
