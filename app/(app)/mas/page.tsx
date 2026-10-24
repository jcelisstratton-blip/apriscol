import type { Metadata } from "next";
import Link from "next/link";
import { Baby, Beef, Download, ChevronRight, Fence, FileBarChart2, FileText, GitFork, Gift, KeyRound, LogOut, MapPin, Package, Pencil, Plus, Rocket, ShieldCheck, SlidersHorizontal, Syringe, TrendingUp, Trophy, Users, Wallet } from "lucide-react";
import { Encabezado } from "@/components/Encabezado";
import { AvisoGuardado } from "@/components/AvisoGuardado";
import { FincaSelector } from "@/components/FincaSelector";
import { Insignia } from "@/components/Insignia";
import { Tarjeta } from "@/components/Tarjeta";
import { esAdminPlataforma, obtenerContexto } from "@/lib/contexto";
import { nombrePlan } from "@/lib/planes";
import { ETIQUETA_ROL, puedeGestionar, puedeVer } from "@/lib/permisos";
import { reportesVisibles } from "@/lib/reportes/catalogo";
import { cerrarSesion } from "@/app/login/actions";

export const metadata: Metadata = { title: "Más" };

const FILA = "flex min-h-14 items-center gap-3.5 px-1 py-2";

/** Una fila de la lista de «Más»: icono, nombre y flecha. */
function Fila({ href, Icono, texto, ocre = false }: { href: string; Icono: typeof Baby; texto: string; ocre?: boolean }) {
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
  const verReportes = reportesVisibles((m) => puedeVer(rol, m, finca.plan)).length > 0 || puedeVer(rol, "contabilidad", finca.plan);
  const verProyecciones = puedeGestionar(rol) && puedeVer(rol, "proyecciones", finca.plan);
  const verManejo = (["reproduccion", "carne", "sanidad", "corrales"] as const).some((m) => puedeVer(rol, m, finca.plan));
  const verDinero = puedeVer(rol, "contabilidad", finca.plan) || verReportes || verProyecciones;

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
            {puedeGestionar(rol) ? (
              <Link href="/mas/finca" className="inline-flex min-h-11 items-center gap-1.5 text-[0.9375rem] font-semibold text-musgo underline-offset-4 hover:underline">
                <Pencil className="size-4" strokeWidth={2} aria-hidden="true" /> Editar datos de la finca
              </Link>
            ) : null}
          </div>
        </Tarjeta>

        {/* Lo mismo que el menú del computador, en el mismo orden: Hoy, Hato y Leche son pestañas de abajo; aquí va el resto, agrupado por tipo de cosa. */}
        {verManejo ? (
          <Tarjeta titulo="Producción y manejo">
            <div className="divide-y divide-arena">
              {puedeVer(rol, "reproduccion", finca.plan) ? <Fila href="/reproduccion" Icono={Baby} texto="Reproducción" /> : null}
              {puedeVer(rol, "carne", finca.plan) ? <Fila href="/carne" Icono={Beef} texto="Carne" /> : null}
              {puedeVer(rol, "sanidad", finca.plan) ? <Fila href="/sanidad" Icono={Syringe} texto="Sanidad" /> : null}
              {puedeVer(rol, "corrales", finca.plan) ? <Fila href="/corrales" Icono={Fence} texto="Corrales" /> : null}
            </div>
          </Tarjeta>
        ) : null}

        {verDinero ? (
          <Tarjeta titulo="Dinero y análisis">
            <div className="divide-y divide-arena">
              {puedeVer(rol, "contabilidad", finca.plan) ? <Fila href="/costos" Icono={Wallet} texto="Costos" /> : null}
              {verReportes ? <Fila href="/reportes" Icono={FileBarChart2} texto="Reportes" /> : null}
              {verProyecciones ? <Fila href="/proyecciones" Icono={TrendingUp} texto="Proyecciones" /> : null}
              {puedeVer(rol, "contabilidad", finca.plan) ? <Fila href="/mas/productos" Icono={Package} texto="Productos y terceros" /> : null}
            </div>
          </Tarjeta>
        ) : null}

        <Tarjeta titulo="Genealogía">
          <div className="divide-y divide-arena">
            <Fila href="/hato/endogamia" Icono={GitFork} texto="Endogamia del hato" />
            {puedeVer(rol, "ferias", finca.plan) ? <Fila href="/ferias" Icono={Trophy} texto="Premios" /> : null}
          </div>
        </Tarjeta>

        <Tarjeta titulo="Mi finca">
          <div className="divide-y divide-arena">
            <Fila href="/mas/ajustes" Icono={SlidersHorizontal} texto="Ajustes de la finca" />
            {puedeGestionar(rol) || puedeVer(rol, "contabilidad", finca.plan) ? <Fila href="/mas/miembros" Icono={Users} texto="Equipo" /> : null}
            <Fila href="/mas/referidos" Icono={Gift} texto="Referidos" ocre />
            {rol === "propietario" ? <Fila href="/mas/plan" Icono={Rocket} texto={finca.plan !== "hacienda" ? "Cambiar el plan de esta finca" : "Plan de esta finca"} ocre /> : null}
            {rol === "propietario" ? <Fila href="/mas/exportar" Icono={Download} texto="Exportar los datos de la finca" /> : null}
            <Fila href="/onboarding" Icono={Plus} texto="Agregar otra finca" />
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
