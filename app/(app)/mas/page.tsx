import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, FileText, KeyRound, LogOut, MapPin, ShieldCheck, type LucideIcon } from "lucide-react";
import { Encabezado } from "@/components/Encabezado";
import { AvisoGuardado } from "@/components/AvisoGuardado";
import { FincaSelector } from "@/components/FincaSelector";
import { Insignia } from "@/components/Insignia";
import { Tarjeta } from "@/components/Tarjeta";
import { esAdminPlataforma, obtenerContexto } from "@/lib/contexto";
import { nombrePlan } from "@/lib/planes";
import { menuFinca, menuPrincipal, visibilidadMenu } from "@/lib/menu";
import { ETIQUETA_ROL } from "@/lib/permisos";
import { cerrarSesion } from "@/app/login/actions";

export const metadata: Metadata = { title: "Más" };

const FILA = "flex min-h-14 items-center gap-3.5 px-1 py-2";

/** Una fila de la lista de «Más»: icono, nombre y flecha. */
function Fila({ href, Icono, texto, ocre = false }: { href: string; Icono: LucideIcon; texto: string; ocre?: boolean }) {
  return (
    <Link href={href} className={FILA}>
      <Icono className={`size-5 ${ocre ? "text-ocre" : "text-musgo"}`} strokeWidth={1.75} />
      <span className="flex-1 font-semibold">{texto}</span>
      <ChevronRight className="size-5 text-humo" strokeWidth={1.75} />
    </Link>
  );
}

export default async function PaginaMas({ searchParams }: { searchParams: Promise<{ guardado?: string }> }) {
  const { guardado } = await searchParams;
  const { user, perfil, finca, fincas, rol } = await obtenerContexto();
  const nombre = perfil?.nombre || user.email;
  const ubicacion = [finca.municipio, finca.departamento].filter(Boolean).join(", ");
  const admin = await esAdminPlataforma();
  const visibilidad = visibilidadMenu(rol, finca.plan);
  // Hoy y Hato son pestañas de la barra de abajo; lo demás del primer grupo (Novedades) sí va aquí.
  const grupos = menuPrincipal(visibilidad).map((g) => (g.id === "inicio" ? { ...g, entradas: g.entradas.filter((e) => e.href !== "/" && e.href !== "/hato") } : g)).filter((g) => g.entradas.length > 0);
  const entradasFinca = menuFinca(visibilidad);

  return (
    <>
      <AvisoGuardado activo={guardado === "1"} />
      <Encabezado titulo="Más" />
      <div className="space-y-3.5 lg:max-w-xl">
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
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Insignia tono="musgo">{ETIQUETA_ROL[rol]}</Insignia>
                {rol === "propietario" ? (
                  <Link href="/mas/plan" aria-label={`Plan ${nombrePlan(finca.plan)}: ver y cambiar el plan de esta finca`} className="-m-2 inline-flex min-h-11 items-center p-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-ocre/15 px-2.5 py-0.5 text-xs font-semibold text-ocre">
                      Plan {nombrePlan(finca.plan)} · Cambiar <ChevronRight className="size-3.5" strokeWidth={2.2} aria-hidden="true" />
                    </span>
                  </Link>
                ) : (
                  <Insignia tono="neutro">Plan {nombrePlan(finca.plan)}</Insignia>
                )}
              </div>
            </div>
            <FincaSelector fincas={fincas.map((f) => ({ id: f.id, nombre: f.nombre, rol: f.rol, logo_path: f.logo_path }))} activa={finca.id} />
          </div>
        </Tarjeta>

        {grupos.map((g) => (
          <Tarjeta key={g.id} titulo={g.titulo}>
            <div className="divide-y divide-arena">
              {g.entradas.map((e) => (
                <Fila key={e.href} href={e.href} Icono={e.Icono} texto={e.etiqueta} ocre={e.acento} />
              ))}
            </div>
          </Tarjeta>
        ))}

        <Tarjeta titulo="Mi finca">
          <div className="divide-y divide-arena">
            {entradasFinca.map((e) => (
              <Fila key={e.href} href={e.href} Icono={e.Icono} texto={e.etiqueta} ocre={e.acento} />
            ))}
          </div>
        </Tarjeta>

        <Tarjeta titulo="Mi cuenta">
          <div className="divide-y divide-arena">
            {admin ? <Fila href="/admin" Icono={ShieldCheck} texto="Panel superadmin" ocre /> : null}
            <Fila href="/cambiar-clave" Icono={KeyRound} texto="Cambiar contraseña" />
            <Fila href="/terminos" Icono={FileText} texto="Términos y privacidad" />
            <form action={cerrarSesion}>
              <button type="submit" className={`${FILA} w-full text-left`}>
                <LogOut className="size-5 text-rojo" strokeWidth={1.75} />
                <span className="flex-1 font-semibold text-rojo">Cerrar sesión</span>
              </button>
            </form>
          </div>
        </Tarjeta>
      </div>
    </>
  );
}
