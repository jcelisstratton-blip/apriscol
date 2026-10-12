import { redirect } from "next/navigation";

/** Registrar sanidad se trabaja en Hato → Sanidad: las direcciones antiguas (y los enlaces guardados) llegan al mismo lugar. */
export default async function PaginaEventoNuevoAntigua({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams)) if (v) q.set(k, v);
  const t = q.toString();
  redirect(t ? `/hato/sanidad/nuevo?${t}` : "/hato/sanidad/nuevo");
}
