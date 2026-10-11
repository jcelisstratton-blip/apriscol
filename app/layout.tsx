import type { Metadata, Viewport } from "next";
import { Figtree, Fraunces } from "next/font/google";
import { ProveedorToasts } from "@/components/Toast";
import "./globals.css";

const figtree = Figtree({ variable: "--font-figtree", subsets: ["latin"], display: "swap" });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "Apriscol", template: "%s · Apriscol" },
  description: "Todo el manejo de tu aprisco —cabras y ovejas— en el bolsillo.",
  applicationName: "Apriscol",
  appleWebApp: { capable: true, title: "Apriscol", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f0e6" },
    { media: "(prefers-color-scheme: dark)", color: "#14120e" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CO" className={`${figtree.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="min-h-full">
        <ProveedorToasts>{children}</ProveedorToasts>
      </body>
    </html>
  );
}
