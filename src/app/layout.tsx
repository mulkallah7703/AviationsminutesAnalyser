import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";

const sans = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "AviationsminuteAnalyser — لوحة الشبكات المحلية",
    template: "%s — AviationsminuteAnalyser",
  },
  description:
    "لوحة محلية لربط حسابات الشبكات. كل شخص يربط حسابه، والرموز تُحفظ مشفّرة على هذا الجهاز.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" className={`${sans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
