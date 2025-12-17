import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

import { Providers } from "./providers"

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "RASTISHKA CRM — Дневник развития",
  description: "CRM и дневник развития для детского сада (РАС/АСД)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className={`${inter.variable} min-h-screen font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
