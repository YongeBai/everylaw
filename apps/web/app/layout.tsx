import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "EveryLaw — What should survive?", template: "%s | EveryLaw" },
  description: "Read every federal law in plain English. Vote to keep or dissolve, and make the strongest case on either side.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"),
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-scroll-behavior="smooth"><body>
    {children}
    {process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN && <Script defer data-domain={process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN} src="https://plausible.io/js/script.js" strategy="lazyOnload" />}
  </body></html>;
}
