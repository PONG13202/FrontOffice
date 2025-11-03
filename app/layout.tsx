// service\app\layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono, Prompt } from "next/font/google";
import "./globals.css";
import ClientProviders from "./ClientProviders";
import SiteFooter from "@/app/components/SiteFooter";
import TopNav from "./components/TopNav";
import { SocketProvider } from "./SocketProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const prompt = Prompt({
  variable: "--font-prompt",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sailom Hotel",
  description: "Sailom Hotel",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css"
          integrity="sha512-Evv84Mr4kqVGRNSgIGL/F/aIDqQb7xQ2vcrdIwxfjThSH8CSR7PBEakCr51Ck+w+/U6swU2Im1vVX0SVk9ABhg=="
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
        />
      </head>
      <body
      
        className={`${geistSans.variable} ${geistMono.variable} ${prompt.variable} antialiased flex flex-col min-h-screen`}
      >
        <SocketProvider>
        <ClientProviders>
          {/* Header */}
          <TopNav />

          {/* Main content (ดันให้กินพื้นที่ที่เหลือ) */}
          <main className="flex-grow">{children}</main>

          {/* Footer */}
          <SiteFooter />
        </ClientProviders>
        </SocketProvider>
      </body>
    </html>
  );
}
