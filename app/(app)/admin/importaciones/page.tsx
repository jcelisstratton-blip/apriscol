import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, Inbox } from "lucide-react";
import { AccionRevertir } from "@/components/AccionRevertir";
import { Encabezado } from "@/components/Encabezado";
import { EstadoVacio } from "@/components/EstadoVacio";
import { Chip, FilaDesplazable } from "@/components/FilaDesplazable";
import { Insignia } from "@/components/Insignia";
import { Tarjeta } from "@/components/Tarjeta";
import { esAdminPlataforma } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { formatoFecha } from "@/lib/fechas";

export const metadata: Metadata = { title: "Importaciones del libro" };

const ETIQUETA = { pendiente: "En proceso", aprobada: "Importada", rechazada: "Rechazada", cancelada: "Revertida" } as const;
const TONO = { pendiente: "aviso", aprobada: "ok", rechazada: "alerta", cancelada: "neutro" } as const;

export default async function PaginaAdminImportaciones({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  if (!(await esAdminPlataforma())) redirect("/mas");
  const { ver } = await searchParams;
  const revertidas = ver === "revertidas";

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("admin_listar_reclamos", { p_estado: revertidas ? "cancelada" : "aprobada" });
  const lista = data ?? [];

  return (
    <>
      <Link href="/mas" className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> Más
      </Link>
      <Encabezado titulo="Importaciones" subtitulo="Libro genealógico · vista global" />
      <div className="mb-3">
        <FilaDesplazable>
          <Link href="/admin/importaciones"><Chip activo={!revertidas} onClick={() => undefined}>Recientes</Chip></Link>
          <Link href="/admin/importaciones?ver=revertidas"><Chip activo={revertidas} onClick={() => undefined}>Revertidas</Chip></Link>
        </FilaDesplazable>
      </div>

      {error ? <p className="text-sm text-rojo">{error.message}</p> : null}

      {lista.length === 0 ? (
        <EstadoVacio
          icono={<Inbox strokeWidth={1.5} />}
          titulo={revertidas ? "No hay importaciones revertidas" : "Todavía no hay importaciones"}
          descripcion="Cuando un propietario traiga sus animales del libro, quedará registrado aquí: quién, en qué finca y cuántos."
        />
      ) : (
        <ul className="grid grid-cols-1 gap-3">
          {lista.map((r) => (
            <li key={r.id} className="min-w-0">
              <Tarjeta>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold [overflow-wrap:anywhere]">{r.finca_nombre}</p>
                    <p className="text-sm text-humo [overflow-wrap:anywhere]">
                      {r.solicitante_nombre || "Sin nombre"} · {r.solicitante_email}
                    </p>
                  </div>
                  <Insignia tono={TONO[r.estado]}>{ETIQUETA[r.estado]}</Insignia>
                </div>
                <dl className="mt-3 divide-y divide-arena text-[0.9375rem]">
                  <div className="flex justify-between gap-4 py-2">
                    <dt className="text-humo">Documento</dt>
                    <dd className="font-semibold">
                      {r.documento_tipo} ••••{r.documento_ultimos4}
                      {r.persona_juridica ? " · empresa" : ""}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4 py-2">
                    <dt className="text-humo">Del titular</dt>
                    <dd className="font-semibold">{r.animales_total} ({r.animales_vivos} vivos)</dd>
                  </div>
                  {r.criaderos.length > 0 ? (
                    <div className="flex justify-between gap-4 py-2">
                      <dt className="shrink-0 text-humo">Criaderos</dt>
                      <dd className="min-w-0 text-right font-semibold [overflow-wrap:anywhere]">{r.criaderos.join(" · ")}</dd>
                    </div>
                  ) : null}
                  <div className="flex justify-between gap-4 py-2">
                    <dt className="text-humo">Fecha</dt>
                    <dd className="font-semibold">{formatoFecha(r.creada_en.slice(0, 10))}</dd>
                  </div>
                </dl>
                                {r.motivo_rechazo ? <p className="mt-2 text-sm text-rojo">Motivo: {r.motivo_rechazo}</p> : null}
                {r.estado === "aprobada" ? (
                  <div className="mt-3">
                    <AccionRevertir id={r.id} animales={r.animales_total} />
                  </div>
                ) : null}
              </Tarjeta>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
