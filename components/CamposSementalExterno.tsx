"use client";

import { Aviso } from "@/components/Aviso";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { Selector } from "@/components/Selector";
import { diasPrestamo, faltantesExterno, PRESTAMO_MAX_DIAS, type DatosExterno } from "@/lib/semental-externo";
import { formatoFecha } from "@/lib/fechas";
import type { Especie, Raza } from "@/lib/tipos";

/**
 * Los datos de un semental que viene de otro hato: quién es (chip, nombre, raza, nacimiento), de dónde viene y a quién se le devuelve
 * (hato, propietario, teléfono), cuánto dura el préstamo y lo que conviene dejar por escrito (sanidad y condiciones).
 * `finTemporada`: si el préstamo termina antes de que cierre la temporada, lo avisa.
 */
export function CamposSementalExterno({
  valor,
  onCambio,
  finTemporada,
  especie,
  razas,
}: {
  valor: DatosExterno;
  onCambio: (v: DatosExterno) => void;
  finTemporada?: string | null;
  /** La especie de la temporada: la raza solo puede ser de esa especie. */
  especie: Especie;
  razas: Raza[];
}) {
  const opcionesRaza = razas.filter((r) => r.especie === especie).map((r) => ({ valor: r.id, etiqueta: r.nombre }));
  const poner = (k: keyof DatosExterno) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onCambio({ ...valor, [k]: e.target.value });
  const fechasOk = /^\d{4}-\d{2}-\d{2}$/.test(valor.desde) && /^\d{4}-\d{2}-\d{2}$/.test(valor.hasta);
  const dias = fechasOk ? diasPrestamo(valor.desde, valor.hasta) : null;
  const problemaFechas = fechasOk && dias != null && (dias < 1 || dias > PRESTAMO_MAX_DIAS);
  const terminaAntes = fechasOk && !problemaFechas && finTemporada ? valor.hasta < finTemporada : false;
  const faltan = faltantesExterno(valor).filter((f) => !f.startsWith("cuándo") && !f.includes("devolución") && !f.includes("préstamo"));

  return (
    <div className="space-y-5">
      <Aviso tipo="info">Este semental no es de tu hato. Con él no se calcula la endogamia porque no tenemos su genealogía: pídesela a su dueño antes de la monta.</Aviso>

      <fieldset className="space-y-4">
        <legend className="mb-1 text-sm font-semibold">El animal</legend>
        <Campo etiqueta="Chip o identificación" ayuda="El número del chip, arete o registro con el que lo identifican.">
          {(id) => <input id={id} value={valor.chip} onChange={poner("chip")} required maxLength={40} autoComplete="off" enterKeyHint="next" className={CLASE_INPUT} />}
        </Campo>
        <Campo etiqueta="Nombre del animal">
          {(id) => <input id={id} value={valor.nombre} onChange={poner("nombre")} required maxLength={80} autoComplete="off" enterKeyHint="next" className={CLASE_INPUT} />}
        </Campo>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo etiqueta="Raza" ayuda={`Razas de ${especie === "caprino" ? "cabras" : "ovejas"}. Es obligatoria.`}>
            {(id) => (
              <Selector
                id={id}
                valor={valor.razaId}
                opciones={opcionesRaza}
                onCambio={(v) => onCambio({ ...valor, razaId: v === "" ? "" : Number(v) })}
                titulo={`Raza (${especie === "caprino" ? "cabra" : "oveja"})`}
                placeholder="Elegir la raza"
              />
            )}
          </Campo>
          <Campo etiqueta="Fecha de nacimiento" ayuda="Opcional. Sirve para saber su edad y cuántas hembras se le recomiendan.">
            {(id) => <input id={id} type="date" value={valor.nacimiento} onChange={poner("nacimiento")} className={CLASE_INPUT} />}
          </Campo>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-1 text-sm font-semibold">De dónde viene</legend>
        <Campo etiqueta="Nombre del hato">
          {(id) => <input id={id} value={valor.hato} onChange={poner("hato")} required maxLength={120} autoComplete="off" enterKeyHint="next" className={CLASE_INPUT} />}
        </Campo>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo etiqueta="Propietario" ayuda="Opcional. Quién lo presta.">
            {(id) => <input id={id} value={valor.propietario} onChange={poner("propietario")} maxLength={120} autoComplete="off" className={CLASE_INPUT} />}
          </Campo>
          <Campo etiqueta="Teléfono de contacto" ayuda="Opcional.">
            {(id) => <input id={id} value={valor.telefono} onChange={poner("telefono")} type="tel" inputMode="tel" maxLength={30} autoComplete="off" className={CLASE_INPUT} />}
          </Campo>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-1 text-sm font-semibold">El préstamo</legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo etiqueta="Llega el">
            {(id) => <input id={id} type="date" value={valor.desde} onChange={poner("desde")} required className={CLASE_INPUT} />}
          </Campo>
          <Campo etiqueta="Se devuelve el">
            {(id) => <input id={id} type="date" value={valor.hasta} onChange={poner("hasta")} required className={CLASE_INPUT} />}
          </Campo>
        </div>
        {dias != null && !problemaFechas ? (
          <p className="text-sm text-humo">
            Duración del préstamo: <strong>{dias} {dias === 1 ? "día" : "días"}</strong> (del {formatoFecha(valor.desde, { day: "numeric", month: "short" })} al {formatoFecha(valor.hasta, { day: "numeric", month: "short", year: "numeric" })}).
          </p>
        ) : null}
        {problemaFechas ? (
          <Aviso tipo="error">{dias != null && dias < 1 ? "La devolución no puede ser antes de la llegada." : `El préstamo puede durar como máximo ${PRESTAMO_MAX_DIAS} días.`}</Aviso>
        ) : null}
        {terminaAntes && finTemporada ? (
          <Aviso tipo="atencion">El semental se devuelve el {formatoFecha(valor.hasta)}, antes del cierre previsto de la temporada ({formatoFecha(finTemporada)}). Revisa que alcance para todas las hembras.</Aviso>
        ) : null}
        <Campo etiqueta="Sanidad y certificados" ayuda="Opcional. Pruebas (brucelosis, tuberculosis…), vacunas, desparasitación o certificado que presentó.">
          {(id) => <textarea id={id} value={valor.sanidad} onChange={poner("sanidad")} rows={2} maxLength={500} className={`${CLASE_INPUT} py-3`} />}
        </Campo>
        <Campo etiqueta="Condiciones del préstamo" ayuda="Opcional. Costo o pago, quién lo transporta, alimentación, cómo se devuelve.">
          {(id) => <textarea id={id} value={valor.condiciones} onChange={poner("condiciones")} rows={2} maxLength={500} className={`${CLASE_INPUT} py-3`} />}
        </Campo>
      </fieldset>
      {faltan.length > 0 ? <p className="text-sm text-humo">Falta {faltan.join(", ")}.</p> : null}
    </div>
  );
}
