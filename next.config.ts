import type { NextConfig } from "next";
import { cabecerasDeSeguridad } from "./lib/cabeceras-seguridad";

const nextConfig: NextConfig = {
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
