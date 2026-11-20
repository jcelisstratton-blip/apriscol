import type { Metadata } from "next";
import { PantallaCampo } from "@/components/campo/PantallaCampo";

export const metadata: Metadata = { title: "Registrar sin señal", robots: { index: false } };

/**
 * «Registrar sin señal» (modo sin señal, paso 3). Página ESTÁTICA e igual para todas las personas, fuera del layout del panel: no lee la
 * sesión ni la base en el servidor, así el service worker puede guardarla y abrirla sin conexión. Todo lo de la finca sale del celular
 * (`PantallaCampo`). Con señal, el filtro de entrada sigue pidiendo sesión para llegar aquí.
 */
export const dynamic = "force-static";

export default function PaginaCampo() {
  return <PantallaCampo />;
}
