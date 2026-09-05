import type { Metadata, Viewport } from "next";
import { Fraunces, Outfit, Caveat, JetBrains_Mono } from "next/font/google";
import { NOM_APP, NOM_ECOLE, urlSite } from "@/lib/config";
import { FournisseurToasts } from "@/components/toast";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--f-display",
  display: "swap",
  axes: ["SOFT", "WONK", "opsz"],
});

const corps = Outfit({
  subsets: ["latin"],
  variable: "--f-body",
  display: "swap",
});

const main = Caveat({
  subsets: ["latin"],
  variable: "--f-hand",
  display: "swap",
  weight: ["400", "600"],
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
    "Réservez une machine à laver de la résidence, suivez les cycles en direct et récupérez votre linge à l'heure. Quatre créneaux par semaine, pour tout le monde.",
  applicationName: NOM_APP,
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: NOM_APP, statusBarStyle: "black-translucent" },
  openGraph: {
    type: "website",
    siteName: NOM_APP,
    title: `${NOM_APP} · la buanderie de Centrale Casablanca`,
    description: "Le planning de la buanderie, en direct.",
  },
  robots: { index: true, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#101a15" },
    { media: "(prefers-color-scheme: light)", color: "#f4edde" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Applique le thème avant la première peinture : pas de flash blanc à 7 h du matin.
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_THEME }} />
      </head>
      <body className={`${display.variable} ${corps.variable} ${main.variable} ${mono.variable} grain antialiased`}>
        <FournisseurToasts>{children}</FournisseurToasts>
      </body>
    </html>
  );
}
