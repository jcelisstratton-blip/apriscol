import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, LogOut, MapPin, Plus, Users } from "lucide-react";
import { Encabezado } from "@/components/Encabezado";
import { FincaSelector } from "@/components/FincaSelector";
import { Insignia } from "@/components/Insignia";
import { Tarjeta } from "@/components/Tarjeta";
import { obtenerContexto } from "@/lib/contexto";
import { ETIQUETA_ROL, puedeGestionar } from "@/lib/permisos";
import { cerrarSesion } from "@/app/login/actions";

export const metadata: Metadata = { title: "Más" };

const FILA = "flex min-h-14 items-center gap-3.5 px-1 py-2";

export default async function PaginaMas() {
  const { user, perfil, finca, fincas, rol } = await obtenerContexto();
  const nombre = perfil?.nombre || user.email;
  const ubicacion = [finca.municipio, finca.departamento].filter(Boolean).join(", ");

  return (
    <>
      <Encabezado titulo="Más" />
      <div className="space-y-3.5">
        {/* Una cuenta es una fila (avatar + nombre + detalle), no un aviso */}
        <Tarjeta>
          <div className="flex items-center gap-3.5">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-musgo font-display text-xl font-semibold text-sobre-musgo" aria-hidden="true">
              {nombre.trim().charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate font-bold">{nombre}</p>
              <p className="truncate text-sm text-humo">{user.email}</p>
            </div>
          </div>
        </Tarjeta>

        <Tarjeta titulo="Finca activa">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-display text-xl font-semibold [overflow-wrap:anywhere]">{finca.nombre}</p>
                {ubicacion ? (
                  <p className="mt-0.5 flex items-center gap-1 text-sm text-humo">
                    <MapPin className="size-3.5 shrink-0" strokeWidth={1.75} /> {ubicacion}
                  </p>
                ) : null}
              </div>
              <Insignia tono="musgo">{ETIQUETA_ROL[rol]}</Insignia>
            </div>
            <FincaSelector fincas={fincas.map((f) => ({ id: f.id, nombre: f.nombre, rol: f.rol }))} activa={finca.id} />
          </div>
        </Tarjeta>

        <Tarjeta className="divide-y divide-arena py-1.5!">
          {puedeGestionar(rol) ? (
            <Link href="/mas/miembros" className={FILA}>
              <Users className="size-5 text-musgo" strokeWidth={1.75} />
              <span className="flex-1 font-semibold">Equipo e invitaciones</span>
              <ChevronRight className="size-5 text-humo" strokeWidth={1.75} />
            </Link>
          ) : null}
          <Link href="/onboarding" className={FILA}>
            <Plus className="size-5 text-musgo" strokeWidth={1.75} />
            <span className="flex-1 font-semibold">Agregar otra finca</span>
            <ChevronRight className="size-5 text-humo" strokeWidth={1.75} />
          </Link>
          <form action={cerrarSesion}>
            <button type="submit" className={`${FILA} w-full text-left`}>
              <LogOut className="size-5 text-rojo" strokeWidth={1.75} />
              <span className="flex-1 font-semibold text-rojo">Cerrar sesión</span>
            </button>
          </form>
        </Tarjeta>
      </div>
    </>
  );
}
