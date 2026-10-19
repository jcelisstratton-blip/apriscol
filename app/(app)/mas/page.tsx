import type { Metadata } from "next";
import Link from "next/link";
import { Baby, Beef, ChevronRight, Fence, FileText, GitFork, KeyRound, LogOut, MapPin, Package, Pencil, Plus, Rocket, ShieldCheck, SlidersHorizontal, Syringe, Trophy, Users, Wallet } from "lucide-react";
import { Encabezado } from "@/components/Encabezado";
import { AvisoGuardado } from "@/components/AvisoGuardado";
import { FincaSelector } from "@/components/FincaSelector";
import { Insignia } from "@/components/Insignia";
import { Tarjeta } from "@/components/Tarjeta";
import { esAdminPlataforma, obtenerContexto } from "@/lib/contexto";
import { nombrePlan, servicioEnPlan } from "@/lib/planes";
import { ETIQUETA_ROL, puedeGestionar, puedeVer } from "@/lib/permisos";
import { cerrarSesion } from "@/app/login/actions";

export const metadata: Metadata = { title: "Más" };

const FILA = "flex min-h-14 items-center gap-3.5 px-1 py-2";

export default async function PaginaMas({ searchParams }: { searchParams: Promise<{ guardado?: string }> }) {
  const { guardado } = await searchParams;
  const { user, perfil, finca, fincas, rol } = await obtenerContexto();
  const nombre = perfil?.nombre || user.email;
  const ubicacion = [finca.municipio, finca.departamento].filter(Boolean).join(", ");
  const admin = await esAdminPlataforma();

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
                <Insignia tono="neutro">Plan {nombrePlan(finca.plan)}</Insignia>
              </div>
            </div>
            <FincaSelector fincas={fincas.map((f) => ({ id: f.id, nombre: f.nombre, rol: f.rol }))} activa={finca.id} />
            {puedeGestionar(rol) ? (
              <Link href="/mas/finca" className="inline-flex min-h-11 items-center gap-1.5 text-[0.9375rem] font-semibold text-musgo underline-offset-4 hover:underline">
                <Pencil className="size-4" strokeWidth={2} aria-hidden="true" /> Editar datos de la finca
              </Link>
            ) : null}
          </div>
        </Tarjeta>

        <Tarjeta className="divide-y divide-arena py-1.5!">
          {admin ? (
            <Link href="/admin" className={FILA}>
              <ShieldCheck className="size-5 text-ocre" strokeWidth={1.75} />
              <span className="flex-1 font-semibold">Panel superadmin</span>
              <ChevronRight className="size-5 text-humo" strokeWidth={1.75} />
            </Link>
          ) : null}
          {puedeVer(rol, "reproduccion", finca.plan) ? (
            <Link href="/reproduccion" className={FILA}>
              <Baby className="size-5 text-musgo" strokeWidth={1.75} />
              <span className="flex-1 font-semibold">Reproducción</span>
              <ChevronRight className="size-5 text-humo" strokeWidth={1.75} />
            </Link>
          ) : null}
          {puedeVer(rol, "carne", finca.plan) ? (
            <Link href="/carne" className={FILA}>
              <Beef className="size-5 text-musgo" strokeWidth={1.75} />
              <span className="flex-1 font-semibold">Carne</span>
              <ChevronRight className="size-5 text-humo" strokeWidth={1.75} />
            </Link>
          ) : null}
          {puedeVer(rol, "sanidad", finca.plan) ? (
            <Link href="/sanidad" className={FILA}>
              <Syringe className="size-5 text-musgo" strokeWidth={1.75} />
              <span className="flex-1 font-semibold">Sanidad</span>
              <ChevronRight className="size-5 text-humo" strokeWidth={1.75} />
            </Link>
          ) : null}
          {puedeVer(rol, "contabilidad", finca.plan) ? (
            <Link href="/costos" className={FILA}>
              <Wallet className="size-5 text-musgo" strokeWidth={1.75} />
              <span className="flex-1 font-semibold">Costos</span>
              <ChevronRight className="size-5 text-humo" strokeWidth={1.75} />
            </Link>
          ) : null}
          {puedeVer(rol, "corrales", finca.plan) ? (
            <Link href="/corrales" className={FILA}>
              <Fence className="size-5 text-musgo" strokeWidth={1.75} />
              <span className="flex-1 font-semibold">Corrales</span>
              <ChevronRight className="size-5 text-humo" strokeWidth={1.75} />
            </Link>
          ) : null}
          <Link href="/hato/endogamia" className={FILA}>
            <GitFork className="size-5 text-musgo" strokeWidth={1.75} />
            <span className="flex-1 font-semibold">Endogamia del hato</span>
            <ChevronRight className="size-5 text-humo" strokeWidth={1.75} />
          </Link>
          {puedeVer(rol, "ferias", finca.plan) ? (
            <Link href="/ferias" className={FILA}>
              <Trophy className="size-5 text-musgo" strokeWidth={1.75} />
              <span className="flex-1 font-semibold">Premios</span>
              <ChevronRight className="size-5 text-humo" strokeWidth={1.75} />
            </Link>
          ) : null}
          {puedeVer(rol, "contabilidad", finca.plan) ? (
            <Link href="/mas/productos" className={FILA}>
              <Package className="size-5 text-musgo" strokeWidth={1.75} />
              <span className="flex-1 font-semibold">Productos y terceros</span>
              <ChevronRight className="size-5 text-humo" strokeWidth={1.75} />
            </Link>
          ) : null}
          <Link href="/mas/ajustes" className={FILA}>
            <SlidersHorizontal className="size-5 text-musgo" strokeWidth={1.75} />
            <span className="flex-1 font-semibold">Ajustes de la finca</span>
            <ChevronRight className="size-5 text-humo" strokeWidth={1.75} />
          </Link>
          {puedeGestionar(rol) || puedeVer(rol, "contabilidad", finca.plan) ? (
            <Link href="/mas/miembros" className={FILA}>
              <Users className="size-5 text-musgo" strokeWidth={1.75} />
              <span className="flex-1 font-semibold">Equipo</span>
              <ChevronRight className="size-5 text-humo" strokeWidth={1.75} />
            </Link>
          ) : null}
          {rol === "propietario" ? (
            <Link href="/mas/plan" className={FILA}>
              <Rocket className="size-5 text-ocre" strokeWidth={1.75} />
              <span className="flex-1 font-semibold">{finca.plan !== "hacienda" ? "Mejorar mi plan" : "Mi plan"}</span>
              <ChevronRight className="size-5 text-humo" strokeWidth={1.75} />
            </Link>
          ) : null}
          <Link href={servicioEnPlan(finca.plan, "fincas") ? "/onboarding" : "/mas/plan?motivo=fincas"} className={FILA}>
            <Plus className="size-5 text-musgo" strokeWidth={1.75} />
            <span className="flex-1 font-semibold">Agregar otra finca</span>
            <ChevronRight className="size-5 text-humo" strokeWidth={1.75} />
          </Link>
          <Link href="/cambiar-clave" className={FILA}>
            <KeyRound className="size-5 text-musgo" strokeWidth={1.75} />
            <span className="flex-1 font-semibold">Cambiar contraseña</span>
            <ChevronRight className="size-5 text-humo" strokeWidth={1.75} />
          </Link>
          <Link href="/terminos" className={FILA}>
            <FileText className="size-5 text-musgo" strokeWidth={1.75} />
            <span className="flex-1 font-semibold">Términos y privacidad</span>
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
