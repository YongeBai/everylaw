import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

const DESCRIPTION = "Read every federal law in plain English. See its history and why it exists, then vote to keep or dissolve — and make the strongest case on either side.";

export const metadata: Metadata = {
  title: { default: "EveryLaw — the front page of the U.S. Code", template: "%s | EveryLaw" },
  description: DESCRIPTION,
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"),
  openGraph: {
    siteName: "everylaw",
    type: "website",
    title: "everylaw — the front page of the U.S. Code",
    description: DESCRIPTION,
  },
  twitter: { card: "summary_large_image" },
};

// Runs before first paint so a stored night-mode choice never flashes light.
const THEME_BOOT = `try{var t=localStorage.getItem("theme");if(t==="dark"||t==="light")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning><body>
    <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
    {children}
    {process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN && <Script defer data-domain={process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN} src="https://plausible.io/js/script.js" strategy="lazyOnload" />}
  </body></html>;
}
