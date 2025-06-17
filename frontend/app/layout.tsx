import type { Metadata } from "next";
// import localFont from 'next/font/local'

import "./globals.css";
import { AuthProvider } from "@/components/layout/auth-provider";
import { ThemeProvider } from "@/components/layout/theme-provider";

// const geistSans = localFont({
//   src: '../public/fonts/Geist-Variable.woff2',
//   variable: "--font-geist-sans",
// });

// const geistMono = localFont({
//   src: '../public/fonts/GeistMono-Variable.woff2',
//   variable: "--font-geist-mono",
// });

export const metadata: Metadata = {
  title: "Auth App",
  description: "Authentication with Go and Next.js",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className="antialiased"
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}