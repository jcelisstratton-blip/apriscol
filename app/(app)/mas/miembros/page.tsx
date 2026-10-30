import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Banknote, ChevronLeft, Plus, Send, Users } from "lucide-react";
import { AvisoGuardado } from "@/components/AvisoGuardado";
import { AyudaModulo } from "@/components/AyudaModulo";
import { clasesBoton } from "@/components/Boton";
import { Encabezado } from "@/components/Encabezado";
import { FilaInvitacion } from "@/components/FilaInvitacion";
import { FormInvitar } from "@/components/FormInvitar";
import { urlDelSitio } from "@/lib/sitio";
import { Insignia } from "@/components/Insignia";
import { ListaPagosPersonal } from "@/components/ListaPagosPersonal";
import { ListaPersonal } from "@/components/ListaPersonal";
import { PestanasTarjetas } from "@/components/TarjetaOpcion";
import { RequierePlan } from "@/components/RequierePlan";
import { Tarjeta } from "@/components/Tarjeta";
import { obtenerContexto } from "@/lib/contexto";
import { AYUDA_PERSONAL } from "@/lib/ayuda";
import { escena } from "@/lib/escenas";
import { formatoFecha, hoyBogota } from "@/lib/fechas";
import { pesos } from "@/lib/ferias";
import { servicioEnPlan } from "@/lib/planes";
import { ETIQUETA_ROL, puedeEscribir, puedeGestionar, puedeVer } from "@/lib/permisos";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { Persona } from "@/lib/tipos";
import { leerTodo } from "@/lib/consultas";

export const metadata: Metadata = { title: "Equipo" };

const VISTAS = ["equipo", "pagos"] as const;
type Vista = (typeof VISTAS)[number];

/**
 * Equipo: todo lo de las personas de la finca en un solo lugar. «Equipo» muestra quién tiene acceso a la app, las invitaciones y a quienes trabajan en la
 * finca con su contrato, y agrega a alguien nuevo (perfil → contrato). «Pagos» registra lo que se les paga: se suma en Costos como mano de obra.
 * Lo ve quien gestiona la finca (propietario, administrador) y quien lleva las cuentas (contador).
 */
export default async function PaginaMiembros({ searchParams }: { searchParams: Promise<{ vista?: string; guardado?: string }> }) {
  const { finca, rol, user } = await obtenerContexto();
  const gestiona = puedeGestionar(rol);
  const cuentas = puedeVer(rol, "contabilidad", finca.plan);
  if (!gestiona && !cuentas) redirect("/mas");
  const sp = await searchParams;
  const vista: Vista = VISTAS.includes(sp.vista as Vista) && cuentas ? (sp.vista as Vista) : "equipo";
  const puedeEditar = puedeEscribir(rol, "contabilidad", finca.plan);
  const hoy = hoyBogota();
  const supabase = await crearClienteServidor();
  const sitio = await urlDelSitio();
  const ahora = new Date();

  const [personalDB, abiertosDB, mesDB] = cuentas
    ? await Promise.all([
        supabase.from("personal").select("*").eq("finca_id", finca.id).order("activo", { ascending: false }).order("nombre"),
        leerTodo((d, h) => supabase.from("pagos_personal").select("costo_total").eq("finca_id", finca.id).is("pagado_en", null).order("id").range(d, h)),
        leerTodo((d, h) => supabase.from("pagos_personal").select("costo_total").eq("finca_id", finca.id).gte("fecha", `${hoy.slice(0, 7)}-01`).order("id").range(d, h)),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];
  const lista = (personalDB.data ?? []) as Persona[];
  const activas = lista.filter((p) => p.activo);
  const porPagar = (abiertosDB.data ?? []).reduce((s, p) => s + Number(p.costo_total), 0);
  const costoMes = (mesDB.data ?? []).reduce((s, p) => s + Number(p.costo_total), 0);

  let miembros: { user_id: string; rol: keyof typeof ETIQUETA_ROL; created_at: string }[] = [];
  let pendientes: { id: string; email: string; rol: keyof typeof ETIQUETA_ROL; expira_en: string; token: string }[] = [];
  const nombres = new Map<string, string>();
  if (gestiona && vista === "equipo") {
    const [{ data: m }, { data: p }] = await Promise.all([
      supabase.from("finca_miembros").select("user_id, rol, created_at").eq("finca_id", finca.id).order("created_at"),
      supabase.from("invitaciones").select("id, email, rol, expira_en, token").eq("finca_id", finca.id).is("aceptada_en", null).order("created_at", { ascending: false }).limit(100),
    ]);
    miembros = m ?? [];
    pendientes = p ?? [];
    const ids = miembros.map((x) => x.user_id);
    const { data: perfiles } = ids.length ? await supabase.from("perfiles").select("id, nombre").in("id", ids) : { data: [] };
    for (const p2 of perfiles ?? []) nombres.set(p2.id, p2.nombre ?? "Sin nombre");
  }

  return (
    <>
      <Link href="/mas" className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo lg:hidden">
        <ChevronLeft className="size-5" strokeWidth={2} /> Más
      </Link>
      <Encabezado titulo="Equipo" subtitulo={finca.nombre} />
      {cuentas ? (
        <PestanasTarjetas
          pestanas={[
            { valor: "equipo", etiqueta: "Equipo", detalle: `${activas.length || miembros.length} ${(activas.length || miembros.length) === 1 ? "persona" : "personas"}`, href: "/mas/miembros", escena: escena(Users, "ocre") },
            { valor: "pagos", etiqueta: "Pagos", detalle: porPagar > 0 ? `${pesos(porPagar)} por pagar` : "Lo que pagas al personal", href: "/mas/miembros?vista=pagos", escena: escena(Banknote, "oliva") },
          ]}
          actual={vista}
        />
      ) : null}
      <div className="space-y-3.5 lg:max-w-2xl">
        <AvisoGuardado activo={sp.guardado === "1"} />
        {vista === "pagos" ? (
          <div className="space-y-4">
            <AyudaModulo ayuda={AYUDA_PERSONAL} />
            {puedeEditar ? (
              activas.length > 0 ? (
                <Link href="/personal/pagos/nuevo" className={clasesBoton("primario")}>
                  <Plus className="size-5" strokeWidth={2.2} aria-hidden="true" /> Registrar un pago
                </Link>
              ) : (
                <Link href="/mas/miembros" className={clasesBoton("primario")}>
                  <Plus className="size-5" strokeWidth={2.2} aria-hidden="true" /> Agregar primero a una persona
                </Link>
              )
            ) : null}
            {costoMes > 0 ? (
              <p className="rounded-2xl bg-lana px-4 py-3 text-[0.9375rem]">
                Mano de obra de este mes: <span className="font-display text-lg font-semibold tabular-nums">{pesos(costoMes)}</span>
              </p>
            ) : null}
            <ListaPagosPersonal fincaId={finca.id} personal={lista} puedeEditar={puedeEditar} />
          </div>
        ) : (
          <>
            {gestiona ? (
              <>
                <Tarjeta titulo="Personas con acceso">
                  <ul className="divide-y divide-arena">
                    {miembros.map((m) => (
                      <li key={m.user_id} className="flex min-h-14 items-center justify-between gap-3 py-2">
                        <span className="min-w-0 font-semibold">
                          {nombres.get(m.user_id)}
                          {m.user_id === user.id ? <span className="font-normal text-humo"> (tú)</span> : null}
                        </span>
                        <Insignia tono={m.rol === "propietario" ? "musgo" : "neutro"}>{ETIQUETA_ROL[m.rol]}</Insignia>
                      </li>
                    ))}
                  </ul>
                </Tarjeta>

                <Link href="/mas/miembros/avisos" className="flex min-h-14 items-center gap-3 rounded-3xl bg-papel px-4 ring-1 ring-arena transition active:scale-[0.99]">
                  <Send className="size-5 shrink-0 text-musgo" strokeWidth={1.8} aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block font-semibold">Avisos por Telegram</span>
                    <span className="block text-sm text-humo">Qué recibe cada persona del equipo y a qué hora</span>
                  </span>
                </Link>

                {pendientes.length > 0 ? (
                  <Tarjeta titulo="Invitaciones pendientes">
                    <ul className="divide-y divide-arena">
                      {pendientes.map((i) => {
                        const vencida = new Date(i.expira_en).getTime() <= ahora.getTime();
                        const vence = formatoFecha(i.expira_en.slice(0, 10), { day: "numeric", month: "short" });
                        return (
                          <FilaInvitacion
                            key={i.id}
                            id={i.id}
                            email={i.email}
                            detalle={`${ETIQUETA_ROL[i.rol]} · ${vencida ? `venció el ${vence}` : `vence el ${vence}`}`}
                            vencida={vencida}
                            enlace={`${sitio}/invitacion/${i.token}`}
                          />
                        );
                      })}
                    </ul>
                  </Tarjeta>
                ) : null}
              </>
            ) : null}

            {cuentas ? (
              <Tarjeta titulo="Quienes trabajan en la finca">
                <ListaPersonal personal={lista} puedeEditar={puedeEditar} />
              </Tarjeta>
            ) : null}

            {gestiona ? (
              <Tarjeta titulo="Agregar a alguien">
                {servicioEnPlan(finca.plan, "equipo") || puedeEditar ? (
                  <FormInvitar hoy={hoy} puedeInvitar={servicioEnPlan(finca.plan, "equipo")} conContrato={puedeEditar} />
                ) : (
                  <RequierePlan servicio="equipo" rol={rol} descripcion={rol === "propietario" ? "Con el plan Hato invitas al ordeñador, al veterinario y al contador, y cada uno ve solo lo suyo." : undefined} />
                )}
              </Tarjeta>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}
