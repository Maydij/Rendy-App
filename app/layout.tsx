// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Rendy — Control Financiero Inteligente",
  description: "Plataforma B2B inteligente de control de gastos corporativos",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="dark" suppressHydrationWarning>
      <head>
        {/* Favicons & Brand Icons */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-icon.png" />

        {/* Google Fonts: Material Symbols & Web Fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=block"
          rel="stylesheet"
        />

        {/* Third-party extension DOM sanitizer (e.g. Urban VPN bis_skin_checked / bis_register) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var o=new MutationObserver(function(m){for(var i=0;i<m.length;i++){var a=m[i].attributeName;if(a&&(a==='bis_skin_checked'||a==='bis_register'||a.indexOf('__processed_')===0)){m[i].target.removeAttribute(a);}}});o.observe(document.documentElement,{attributes:true,subtree:true});}catch(e){}})();`,
          }}
        />
      </head>
      <body className="bg-surface-container-lowest text-on-surface antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}