import Link from "next/link";
import { Send } from "lucide-react";
import { AccionVigencia } from "@/components/AccionVigencia";
import { BotonesRecordatorio } from "@/components/BotonesRecordatorio";
import { Insignia } from "@/components/Insignia";
import { FilaPago } from "@/components/ListaPagos";
import { Tarjeta } from "@/components/Tarjeta";
import { mensajeCobranza, telefonoWhatsApp } from "@/lib/cobranza";
import { textoAuditoria } from "@/lib/auditoria-texto";
import { diasHasta, fechaHoraBogota, formatoFecha, hoyBogota } from "@/lib/fechas";
import type { DatosNequi } from "@/lib/pago-manual";
import { nombrePlan } from "@/lib/planes";
import type { FichaFinca } from "@/lib/tipos";

const ETIQUETA = { vigente: "Al día", por_vencer: "Por vencer", gracia: "Solo lectura", bloqueada: "Bloqueada", pendiente: "Pendiente de pago" } as const;
const TONO = { vigente: "musgo", por_vencer: "aviso", gracia: "aviso", bloqueada: "alerta", pendiente: "aviso" } as const;
const ESTADO_SOLICITUD = { pendiente: "Pendiente", activada: "Atendida", cancelada: "Cancelada" } as const;

function Fila({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-3 py-2.5">
      <dt className="shrink-0 text-[0.9375rem] text-humo">{etiqueta}</dt>
      <dd className="min-w-0 text-right text-[0.9375rem] font-semibold [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

/** Una finca a fondo para el superadmin: dueño y contacto, plan y vigencia con sus acciones, uso, pagos, solicitudes y bitácora de esa finca. */
export function FichaFincaVista({ ficha, nequi }: { ficha: FichaFinca; nequi: DatosNequi | null }) {
  const { finca, propietario, uso } = ficha;
  const dueno = propietario ?? { email: "", nombre: "", telefono: "", ultimo_ingreso: null, registrado_en: finca.creada_en, cuenta_pruebas: false };
  const mensaje = mensajeCobranza(
    {
      finca_id: finca.id, nombre: finca.nombre, propietario_email: dueno.email, propietario_nombre: dueno.nombre, telefono: dueno.telefono, plan: finca.plan,
      plan_vence_en: finca.plan_vence_en, estado: finca.estado, dias_restantes: finca.plan_vence_en ? diasHasta(finca.plan_vence_en, hoyBogota()) : null,
      numero_finca: finca.numero_finca, cuenta_pruebas: dueno.cuenta_pruebas, ultimo_pago_en: null,
    },
    nequi,
  );
  const lugar = [finca.vereda, finca.municipio, finca.departamento].filter(Boolean).join(", ");

  return (
    <div className="space-y-3.5 pb-4">
      <div className="flex flex-wrap items-center gap-2">
        <Insignia tono={TONO[finca.estado]}>{ETIQUETA[finca.estado]}</Insignia>
        <Insignia tono="musgo">Plan {nombrePlan(finca.plan)}</Insignia>
        {dueno.cuenta_pruebas ? <Insignia tono="neutro">Cuenta de pruebas</Insignia> : null}
      </div>

      <Tarjeta titulo="Propietario">
        <dl className="divide-y divide-arena">
          {dueno.nombre ? <Fila etiqueta="Nombre">{dueno.nombre}</Fila> : null}
          <Fila etiqueta="Correo">{dueno.email || "Sin propietario"}</Fila>
          <Fila etiqueta="Celular">{dueno.telefono ? dueno.telefono : "No lo dejó"}</Fila>
          <Fila etiqueta="Último ingreso">{dueno.ultimo_ingreso ? fechaHoraBogota(dueno.ultimo_ingreso) : "Nunca ha ingresado"}</Fila>
          <Fila etiqueta="Se registró">{formatoFecha(dueno.registrado_en.slice(0, 10))}</Fila>
        </dl>
        {mensaje ? (
          <div className="mt-3 space-y-2">
            {!telefonoWhatsApp(dueno.telefono) ? <p className="text-sm text-humo">Sin celular válido: copia el mensaje y envíalo por correo.</p> : null}
            <BotonesRecordatorio mensaje={mensaje} telefono={dueno.telefono} />
          </div>
        ) : null}
      </Tarjeta>

      <Tarjeta titulo="Plan y vigencia">
        <dl className="mb-3 divide-y divide-arena">
          <Fila etiqueta="Finca n.º">{finca.numero_finca}{finca.numero_finca > 1 ? " · 10 % menos" : ""}</Fila>
          <Fila etiqueta="Pagada hasta">{finca.plan_vence_en ? formatoFecha(finca.plan_vence_en, { day: "numeric", month: "long", year: "numeric" }) : finca.estado === "pendiente" ? "Esperando el primer pago" : "Sin vencimiento"}</Fila>
          <Fila etiqueta="Activada">{finca.activada_en ? formatoFecha(finca.activada_en.slice(0, 10)) : "Todavía no"}</Fila>
        </dl>
        <AccionVigencia fincaId={finca.id} plan={finca.plan} venceEn={finca.plan_vence_en} correo={dueno.email} cuentaPruebas={dueno.cuenta_pruebas} />
      </Tarjeta>

      <Link href={`/admin/fincas/${finca.id}/avisos`} className="flex min-h-14 items-center gap-3 rounded-3xl bg-papel px-4 ring-1 ring-arena transition active:scale-[0.99]">
        <Send className="size-5 shrink-0 text-musgo" strokeWidth={1.8} />
        <span className="min-w-0">
          <span className="block font-semibold">Avisos por Telegram</span>
          <span className="block text-sm text-humo">Hora, días y nivel del resumen de cada persona</span>
        </span>
      </Link>

      <Tarjeta titulo="Uso">
        <dl className="divide-y divide-arena">
          <Fila etiqueta="Animales activos">{uso.animales_activos}</Fila>
          <Fila etiqueta="Personas en el equipo">{uso.miembros}</Fila>
          <Fila etiqueta="Creada">{formatoFecha(finca.creada_en.slice(0, 10))}</Fila>
          {lugar ? <Fila etiqueta="Ubicación">{lugar}</Fila> : null}
        </dl>
      </Tarjeta>

      <section className="space-y-2.5" aria-label="Pagos de esta finca">
        <h2 className="font-display text-xl font-semibold">Pagos</h2>
        {ficha.pagos.length === 0 ? (
          <p className="text-sm text-humo">Todavía no hay pagos confirmados de esta finca.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-2.5">
            {ficha.pagos.map((p) => (
              <li key={p.id} className="min-w-0">
                <FilaPago p={p} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {ficha.solicitudes.length > 0 ? (
        <section className="space-y-2.5" aria-label="Solicitudes de plan">
          <h2 className="font-display text-xl font-semibold">Solicitudes</h2>
          <ul className="grid grid-cols-1 gap-2">
            {ficha.solicitudes.map((s) => (
              <li key={s.created_at} className="flex min-w-0 items-start justify-between gap-3 rounded-2xl bg-papel p-3.5 ring-1 ring-arena">
                <p className="min-w-0 text-[0.9375rem] [overflow-wrap:anywhere]">
                  {s.plan_actual === s.plan_nuevo ? `Renovar ${nombrePlan(s.plan_nuevo)}` : `${nombrePlan(s.plan_actual)} → ${nombrePlan(s.plan_nuevo)}`} · {s.periodo === "anual" ? "anual" : "mensual"}
                  <span className="block text-xs text-humo">{fechaHoraBogota(s.created_at)}</span>
                </p>
                <Insignia tono={s.estado === "pendiente" ? "aviso" : "neutro"}>{ESTADO_SOLICITUD[s.estado]}</Insignia>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {ficha.bitacora.length > 0 ? (
        <section className="space-y-2.5" aria-label="Bitácora de esta finca">
          <h2 className="font-display text-xl font-semibold">Bitácora</h2>
          <ul className="grid grid-cols-1 gap-2">
            {ficha.bitacora.map((a) => (
              <li key={a.id} className="min-w-0 space-y-1 rounded-2xl bg-papel p-3.5 ring-1 ring-arena">
                <p className="text-[0.9375rem] [overflow-wrap:anywhere]">{textoAuditoria(a)}</p>
                <p className="text-xs text-humo [overflow-wrap:anywhere]">
                  {fechaHoraBogota(a.created_at)} · {a.actor_email || "—"}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
