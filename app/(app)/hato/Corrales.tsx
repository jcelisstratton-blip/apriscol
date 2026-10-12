import Link from "next/link";
import { AlertTriangle, ArrowRightLeft, Fence, Plus } from "lucide-react";
import { AvisoGuardado } from "@/components/AvisoGuardado";
import { clasesBoton } from "@/components/Boton";
import { EstadoVacio } from "@/components/EstadoVacio";
import { Insignia } from "@/components/Insignia";
import { TarjetaUbicacion } from "@/components/TarjetaUbicacion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { animalesPorIds } from "@/lib/animal-etiquetas";
import { etiquetaAnimal } from "@/lib/animal";
import { estadoCuarentena } from "@/lib/corrales";
import type { CuarentenaAlerta, UbicacionVista } from "@/lib/tipos";

/**
 * Hato → Corrales: donde se trabajan las instalaciones y la ubicación de los animales. Se crean corrales y potreros, se mueven animales (o un
 * lote entero, para rotarlo de potrero) y se ven las alertas: hacinamiento, potreros que deben descansar o desocuparse y cuarentena. El
 * resumen de toda la finca, con filtros por fechas, está en el menú «Corrales».
 */
export async function Corrales({
  fincaId,
  puedeEditar,
  guardado = false,
  cliente,
}: {
  fincaId: string;
  puedeEditar: boolean;
  guardado?: boolean;
  /** Solo para pruebas: un cliente de base de datos en lugar del de la sesión. */
  cliente?: Awaited<ReturnType<typeof crearClienteServidor>>;
}) {
  const supabase = cliente ?? (await crearClienteServidor());
  const [ubicacionesDB, cuarentenaDB, activosDB] = await Promise.all([
    supabase.from("v_ubicaciones").select("*").eq("finca_id", fincaId).order("tipo").order("nombre").limit(300),
    supabase.from("v_cuarentena_alerta").select("*").eq("finca_id", fincaId).limit(500),
    supabase.from("animales").select("id", { count: "exact", head: true }).eq("finca_id", fincaId).eq("estado", "activo").is("deleted_at", null),
  ]);
  const todas = (ubicacionesDB.data ?? []) as UbicacionVista[];
  const activas = todas.filter((u) => u.activa);
  const archivadas = todas.filter((u) => !u.activa);
  const corrales = activas.filter((u) => u.tipo === "corral");
  const potreros = activas.filter((u) => u.tipo === "potrero");
  const cuarentena = (cuarentenaDB.data ?? []) as CuarentenaAlerta[];
  const hacinadas = activas.filter((u) => u.hacinada);
  const debenSalir = potreros.filter((u) => u.estado === "debe_salir");
  const ubicados = activas.reduce((s, u) => s + u.ocupantes, 0);
  const sinUbicacion = Math.max(0, (activosDB.count ?? 0) - todas.reduce((s, u) => s + u.ocupantes, 0));
  void ubicados;

  const nombres = new Map((await animalesPorIds(supabase, fincaId, cuarentena.map((c) => c.animal_id))).map((a) => [a.id, etiquetaAnimal(a)]));
  const enCuarentena = cuarentena.filter((c) => c.situacion === "en_cuarentena").sort((a, b) => b.dias - a.dias);
  const faltaCuarentena = cuarentena.filter((c) => c.situacion === "falta_cuarentena");
  const hayAlertas = hacinadas.length > 0 || debenSalir.length > 0 || faltaCuarentena.length > 0 || enCuarentena.length > 0;

  return (
    <div className="space-y-4">
      <AvisoGuardado activo={guardado} />
      <p className="text-[0.9375rem] text-humo">
        Aquí armas tus corrales y potreros, mueves a los animales (o un lote entero para rotarlo) y ves dónde hay hacinamiento, qué potrero debe desocuparse o descansar y cómo van
        los animales en cuarentena. El resumen de toda la finca, con filtros por fechas, está en{" "}
        <Link href="/corrales" className="font-semibold text-musgo underline underline-offset-2">Corrales</Link>.
      </p>
      {puedeEditar ? (
        <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
          <Link href="/hato/corrales/mover" className={clasesBoton("primario")}>
            <ArrowRightLeft className="size-5" strokeWidth={2} aria-hidden="true" /> Mover animales
          </Link>
          <Link href="/hato/corrales/nueva" className={clasesBoton("secundario")}>
            <Plus className="size-5" strokeWidth={2.2} aria-hidden="true" /> Nueva instalación
          </Link>
        </div>
      ) : null}

      {activas.length === 0 ? (
        <EstadoVacio
          icono={<Fence strokeWidth={1.5} />}
          titulo="Todavía no hay corrales ni potreros"
          descripcion="Crea tus corrales (maternidad, crías, cuarentena, ordeño…) y tus potreros para saber dónde está cada animal, evitar el hacinamiento y rotar bien el pastoreo."
        />
      ) : null}

      {hayAlertas ? (
        <section className="space-y-2 rounded-2xl bg-lana p-3.5" aria-label="Alertas">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <AlertTriangle className="size-5 text-ocre" strokeWidth={1.9} aria-hidden="true" /> Para revisar
          </h2>
          <ul className="space-y-1.5 text-[0.9375rem]">
            {hacinadas.map((u) => (
              <li key={u.id}>
                <Link href={`/hato/corrales/${u.id}`} className="font-semibold underline-offset-4 hover:underline">{u.nombre}</Link> tiene {u.ocupantes} animales y le caben {u.capacidad}: hay hacinamiento.
              </li>
            ))}
            {debenSalir.map((u) => (
              <li key={u.id}>
                <Link href={`/hato/corrales/${u.id}`} className="font-semibold underline-offset-4 hover:underline">{u.nombre}</Link> lleva {u.dias_ocupacion} días ocupado (máximo {u.dias_ocupacion_max}): el lote debe pasar a otro potrero.
              </li>
            ))}
            {faltaCuarentena.length > 0 ? (
              <li>
                {faltaCuarentena.length} {faltaCuarentena.length === 1 ? "animal comprado" : "animales comprados"} en los últimos 30 días {faltaCuarentena.length === 1 ? "no ha pasado" : "no han pasado"} por cuarentena:{" "}
                {faltaCuarentena.slice(0, 3).map((c) => nombres.get(c.animal_id) ?? "Animal").join(", ")}
                {faltaCuarentena.length > 3 ? ` y ${faltaCuarentena.length - 3} más` : ""}.
              </li>
            ) : null}
          </ul>
          {enCuarentena.length > 0 ? (
            <div className="border-t border-arena pt-2">
              <p className="text-sm font-semibold">En cuarentena ({enCuarentena.length})</p>
              <ul className="mt-1 divide-y divide-arena">
                {enCuarentena.slice(0, 8).map((c) => {
                  const e = estadoCuarentena(c.dias);
                  return (
                    <li key={c.animal_id} className="flex items-center justify-between gap-2 py-1.5">
                      <Link href={`/hato/${c.animal_id}#ubicacion`} className="min-w-0 text-[0.9375rem] [overflow-wrap:anywhere] hover:underline">{nombres.get(c.animal_id) ?? "Animal"}</Link>
                      <Insignia tono={e.tono}>{e.texto}</Insignia>
                    </li>
                  );
                })}
              </ul>
              {enCuarentena.length > 8 ? <p className="mt-1 text-sm text-humo">Y {enCuarentena.length - 8} más.</p> : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {sinUbicacion > 0 && activas.length > 0 ? (
        <p className="text-sm text-humo">
          {sinUbicacion} {sinUbicacion === 1 ? "animal no tiene" : "animales no tienen"} ubicación todavía.
          {puedeEditar ? (
            <>
              {" "}
              <Link href="/hato/corrales/mover?grupo=sin_ubicacion" className="font-semibold text-musgo underline underline-offset-2">Ubicarlos</Link>
            </>
          ) : null}
        </p>
      ) : null}

      {corrales.length > 0 ? (
        <section className="space-y-2" aria-label="Corrales">
          <h2 className="font-display text-lg font-semibold">Corrales</h2>
          <ul className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
            {corrales.map((u) => (
              <TarjetaUbicacion key={u.id} u={u} puedeEditar={puedeEditar} />
            ))}
          </ul>
        </section>
      ) : null}

      {potreros.length > 0 ? (
        <section className="space-y-2" aria-label="Potreros">
          <h2 className="font-display text-lg font-semibold">Potreros y rotación</h2>
          <ul className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
            {potreros.map((u) => (
              <TarjetaUbicacion key={u.id} u={u} puedeEditar={puedeEditar} />
            ))}
          </ul>
        </section>
      ) : null}

      {archivadas.length > 0 ? (
        <details className="rounded-2xl bg-lana px-3.5">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between text-sm font-semibold text-humo">Archivadas ({archivadas.length})</summary>
          <ul className="divide-y divide-arena pb-2">
            {archivadas.map((u) => (
              <li key={u.id}>
                <Link href={`/hato/corrales/${u.id}`} className="flex min-h-12 items-center justify-between gap-2 text-[0.9375rem] hover:underline">
                  <span className="min-w-0 [overflow-wrap:anywhere]">{u.nombre}</span>
                  <span className="shrink-0 text-sm text-humo">Ver</span>
                </Link>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
