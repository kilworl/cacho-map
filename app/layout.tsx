import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Cacho-Map Cartagena", description: "Taste-incompatibility map for couples, powered by Qloo", metadataBase: new URL(process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000") };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="es"><body>{children}</body></html>;
}
