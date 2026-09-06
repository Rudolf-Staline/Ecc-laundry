import type { Metadata, Viewport } from "next";
import { Roboto, JetBrains_Mono } from "next/font/google";
import { NOM_APP, NOM_ECOLE, urlSite } from "@/lib/config";
import { FournisseurToasts } from "@/components/toast";
import "./globals.css";
import "./ambient.css";

const corps = Roboto({
  subsets: ["latin"],
  variable: "--f-body",
  display: "swap",
  weight: ["400", "500", "700"],
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--f-mono",
  display: "swap",
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(urlSite),
  title: {
    default: `${NOM_APP} · Buanderie de l'${NOM_ECOLE}`,
    template: `%s · ${NOM_APP}`,
  },
  description:
    "Réservez une machine à laver de la résidence, consultez le calendrier et suivez vos réservations depuis Laundry.",
  applicationName: NOM_APP,
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: NOM_APP, statusBarStyle: "black-translucent" },
  openGraph: {
    type: "website",
    siteName: NOM_APP,
    title: `${NOM_APP} · la buanderie de Centrale Casablanca`,
    description: "La buanderie du campus, claire et simple à réserver.",
  },
  robots: { index: true, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#071a24" },
    { media: "(prefers-color-scheme: light)", color: "#eef7f8" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const SCRIPT_THEME = `
(function () {
  try {
    var t = localStorage.getItem("tambour-theme");
    if (!t) t = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", t);
  } catch (e) {
    document.documentElement.setAttribute("data-theme", "light");
  }
})();
`;

const BULLES_GLOBALES = [1, 3, 5, 7, 9, 11, 13, 14];

function AmbianceGlobale() {
  return (
    <div className="laundry-backdrop" aria-hidden="true">
      <div className="laundry-flow laundry-flow-a" />
      <div className="laundry-flow laundry-flow-b" />
      <div className="laundry-flow laundry-flow-c" />
      <div className="laundry-sheen" />

      <div className="global-soap-field">
        {BULLES_GLOBALES.map((n) => (
          <span key={n} className={`soap-bubble soap-bubble-${n}`} />
        ))}
      </div>
    </div>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_THEME }} />
      </head>
      <body className={`${corps.variable} ${mono.variable} antialiased`}>
        <AmbianceGlobale />
        <div className="laundry-content-layer">
          <FournisseurToasts>{children}</FournisseurToasts>
        </div>
      </body>
    </html>
  );
}
