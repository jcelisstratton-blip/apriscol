import type { Metadata } from "next";
import { EntrarDesdeTelegram } from "@/components/EntrarDesdeTelegram";

export const metadata: Metadata = { title: "Abriendo Apriscol", robots: { index: false } };

/** Destino de los botones «Abrir … en la app» del bot de Telegram. La comprobación de quién es la hace `/api/telegram/sesion`; aquí solo se pasan la finca y la pantalla pedida. */
export default async function PaginaEntrarDesdeTelegram({ searchParams }: { searchParams: Promise<{ f?: string; d?: string }> }) {
  const { f, d } = await searchParams;
  return <EntrarDesdeTelegram finca={f ?? ""} destino={d ?? ""} />;
}
