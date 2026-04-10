import type { Metadata } from "next";
import { Playfair_Display, DM_Sans } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://rackintherockies.com"),
  title: {
    default: "Rack in the Rockies | Mahjong. Community. Style.",
    template: "%s | Rack in the Rockies",
  },
  description:
    "Curated mahjong sets, elevated game nights, and unforgettable experiences from Denver, Colorado.",
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Rack in the Rockies",
    title: "Rack in the Rockies | Mahjong. Community. Style.",
    description:
      "Curated mahjong sets, elevated game nights, and unforgettable experiences from Denver, Colorado.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Rack in the Rockies | Mahjong. Community. Style.",
    description:
      "Curated mahjong sets, elevated game nights, and unforgettable experiences from Denver, Colorado.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${playfair.variable} ${dmSans.variable}`}>
      <body className="font-body bg-warm-white text-text-dark antialiased">
        <Nav />
        {children}
        <Footer />
      </body>
    </html>
  );
}
