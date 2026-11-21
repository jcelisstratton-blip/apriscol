import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Apriscol",
    short_name: "Apriscol",
    description: "Todo el manejo de tu aprisco —cabras y ovejas— en el bolsillo.",
    lang: "es-CO",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f5f0e6",
    theme_color: "#f5f0e6",
    // Mantener presionado el ícono de la app: directo a registrar sin señal (abre aunque no haya conexión).
    shortcuts: [{ name: "Registrar sin señal", short_name: "Sin señal", description: "Animal, ordeño, pesos, partos, sanidad, compras y más, guardados en el celular", url: "/campo", icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }] }],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
