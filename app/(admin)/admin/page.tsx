import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, UserX } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Encabezado } from "@/components/Encabezado";
import { Tarjeta } from "@/components/Tarjeta";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Panel global" };

const num = (n: number) => n.toLocaleString("es-CO");

export default async function PanelGlobal() {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("admin_resumen");

  if (error || !data) {
    return (
      <>
        <Encabezado titulo="Panel global" subtitulo="Toda la plataforma" />
        <Aviso tipo="error">{error?.message ?? "No se pudo cargar el resumen."}</Aviso>
      </>
    );
  }
  const r = data as Record<string, number>;
  const enFincas = r.libro_total > 0 ? Math.round((r.libro_en_fincas / r.libro_total) * 100) : 0;

  const tiles: { etiqueta: string; valor: string; detalle?: string; href?: string }[] = [
    { etiqueta: "Usuarios", valor: num(r.usuarios), detalle: `${num(r.nuevos_30d)} nuevos en 30 días` },
    { etiqueta: "Fincas", valor: num(r.fincas), href: "/admin/fincas" },
    { etiqueta: "Animales activos", valor: num(r.animales_activos), detalle: "en todas las fincas" },
    { etiqueta: "Leche, 7 días", valor: `${num(Math.round(r.litros_7d))} L`, detalle: "sin contar descartada" },
    { etiqueta: "Libro genealógico", valor: num(r.libro_total), detalle: `${num(r.libro_en_fincas)} ya en fincas · ${enFincas} %` },
    { etiqueta: "Importaciones", valor: num(r.importaciones), href: "/admin/importaciones" },
  ];

  return (
    <>
      <Encabezado titulo="Panel global" subtitulo="Toda la plataforma" />
      <div className="space-y-3.5">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {tiles.map((t) => {
            const cuerpo = (
              <>
                <dt className="text-sm font-medium text-humo">{t.etiqueta}</dt>
                <dd className="mt-1 font-display text-2xl font-semibold leading-none tabular-nums sm:text-3xl">{t.valor}</dd>
                {t.detalle ? <p className="mt-1.5 text-xs text-humo">{t.detalle}</p> : null}
              </>
            );
            return t.href ? (
              <Link key={t.etiqueta} href={t.href} className="min-w-0 rounded-3xl bg-papel p-4 ring-1 ring-arena transition active:scale-[0.99]">
                {cuerpo}
              </Link>
            ) : (
              <div key={t.etiqueta} className="min-w-0 rounded-3xl bg-papel p-4 ring-1 ring-arena">
                {cuerpo}
              </div>
            );
          })}
        </dl>

        {r.sin_finca > 0 ? (
          <Tarjeta>
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-arena text-humo">
                <UserX className="size-5" strokeWidth={1.75} />
              </span>
              <p className="min-w-0 text-[0.9375rem]">
                <span className="font-semibold">{num(r.sin_finca)} {r.sin_finca === 1 ? "usuario" : "usuarios"} sin finca.</span>{" "}
                <span className="text-humo">Se registraron pero no terminaron de crear su finca (incluida tu cuenta de superadmin, si no tiene una).</span>
              </p>
            </div>
          </Tarjeta>
        ) : null}

        <Link href="/admin/fincas" className="flex min-h-14 items-center justify-between gap-3 rounded-2xl bg-papel px-4 ring-1 ring-arena">
          <span className="font-semibold">Ver todas las fincas</span>
          <ChevronRight className="size-5 text-humo" strokeWidth={1.75} />
        </Link>
      </div>
    </>
  );
}
