import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import "@radix-ui/themes/styles.css";
import "../eden-theme/reset.scss";
import "../eden-theme/theme.scss";
import "../eden-theme/radix.scss";
import "../coordinator/styles.css";

const GIPHURS = localFont({ src: "../../public/fonts/Giphurs-Variable.woff2", variable: "--font-giphurs", display: "swap" });

export const metadata: Metadata = { title: "Swarm", robots: { index: false, follow: false } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, interactiveWidget: "resizes-content", themeColor: "#15191b" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" data-theme="dark" suppressHydrationWarning className={GIPHURS.variable}><body><Script id="swarm-appearance" strategy="beforeInteractive">{`try { document.documentElement.dataset.theme = localStorage.getItem('swarm.appearance.v1') === 'light' ? 'light' : 'dark'; } catch { document.documentElement.dataset.theme = 'dark'; }`}</Script>{children}</body></html>;
}
