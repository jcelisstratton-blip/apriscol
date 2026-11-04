import type { NextConfig } from "next";
import { cabecerasDeSeguridad } from "./lib/cabeceras-seguridad";

const nextConfig: NextConfig = {
  // El cargue de animales sube un Excel por una acción del servidor (por defecto el tope es 1 MB); Vercel corta las peticiones en 4,5 MB.
  experimental: { serverActions: { bodySizeLimit: "4.5mb" } },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: cabecerasDeSeguridad(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.NODE_ENV === "production") }];
  },
};

export default nextConfig;
