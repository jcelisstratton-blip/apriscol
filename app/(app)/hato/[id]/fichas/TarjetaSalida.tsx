import Link from "next/link";
import { Insignia } from "@/components/Insignia";
import { Tarjeta } from "@/components/Tarjeta";
import { puedeEscribir, puedeGestionar, puedeVer } from "@/lib/permisos";
import { clasesBoton } from "@/components/Boton";
import { formatoFecha, litros } from "@/lib/fechas";
import { pesos } from "@/lib/ferias";
import { ETIQUETA_MOTIVO_BAJA, ETIQUETA_TIPO_BAJA } from "@/lib/bajas";
import { DeshacerBaja } from "@/components/DeshacerBaja";
import { ETIQUETA_CONFORMACION, ETIQUETA_ENGRASAMIENTO, ETIQUETA_GRASA_VISCERAL, kg, pctUno } from "@/lib/carne";
import { controlesDeSalida, etiquetaResumen, resumenControles } from "@/lib/controles";
import type { CtxFicha } from "./contexto";
import { Dato } from "./Dato";

/** Cómo salió del hato (baja, controles de calidad, canal) o el acceso para darlo de baja. */
export async function TarjetaSalida({ c }: { c: CtxFicha }) {
  const { id, animal, finca, rol, supabase } = c;
  const verCarne = puedeVer(rol, "carne", finca.plan);
  const baja = animal.estado !== "activo" ? await supabase.from("bajas").select("*").eq("animal_id", id).maybeSingle() : { data: null };
  // Controles de calidad de un animal que salió para consumo (condición corporal, inspección en el matadero).
  const aplicanControles = baja.data ? controlesDeSalida(baja.data.tipo, baja.data.destino_consumo) : [];
  const controlesAnimal =
    verCarne && aplicanControles.length > 0
      ? ((await supabase.from("controles_calidad").select("tipo, estado").eq("animal_id", id).eq("finca_id", finca.id)).data ?? [])
      : [];
  const etiquetaControles = etiquetaResumen(resumenControles(aplicanControles, controlesAnimal));
  // Canal (rendimiento al beneficio) de un animal sacrificado.
  const canal =
    verCarne && baja.data?.tipo === "sacrificio"
      ? (await supabase.from("v_canales").select("*").eq("animal_id", id).eq("finca_id", finca.id).maybeSingle()).data
      : null;

  return (
    <>
    {animal.estado !== "activo" ? (
      <Tarjeta titulo="Salida del hato" id="salida">
        <dl className="divide-y divide-arena">
          <Dato etiqueta="Qué pasó">{baja.data ? ETIQUETA_TIPO_BAJA[baja.data.tipo] : animal.estado[0].toUpperCase() + animal.estado.slice(1)}</Dato>
          <Dato etiqueta="Fecha">{formatoFecha(baja.data?.fecha ?? animal.fecha_baja)}</Dato>
          {baja.data?.motivo ? <Dato etiqueta="Motivo">{ETIQUETA_MOTIVO_BAJA[baja.data.motivo]}</Dato> : null}
          {baja.data?.comprador ? <Dato etiqueta="Comprador">{baja.data.comprador}</Dato> : null}
          {baja.data?.valor ? <Dato etiqueta="Valor">{pesos(baja.data.valor)}</Dato> : null}
          {baja.data?.peso_kg ? <Dato etiqueta="Peso en vivo">{kg(baja.data.peso_kg)}</Dato> : null}
          {baja.data?.guia_movilizacion ? <Dato etiqueta="Guía de movilización">{baja.data.guia_movilizacion}</Dato> : null}
          {baja.data?.destino ? <Dato etiqueta={baja.data.tipo === "sacrificio" ? "Lugar del beneficio" : "Destino"}>{baja.data.destino}</Dato> : null}
          {baja.data?.tipo === "sacrificio" || (baja.data?.tipo === "venta" && baja.data.destino_consumo) ? (
            <Dato etiqueta="Carne">Para consumo</Dato>
          ) : baja.data?.tipo === "muerte" ? (
            <Dato etiqueta="Carne">No apta para consumo</Dato>
          ) : null}
        </dl>
        {baja.data?.detalle ? <p className="mt-3 whitespace-pre-wrap text-[0.9375rem] text-humo">{baja.data.detalle}</p> : null}
        {baja.data && puedeEscribir(rol, "hato", finca.plan) ? (
          <Link href={`/hato/${id}/baja/editar`} className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-musgo underline-offset-4 hover:underline">
            Corregir datos de la salida
          </Link>
        ) : null}
        {verCarne && aplicanControles.length > 0 ? (
          <div className="mt-3 space-y-2 border-t border-arena pt-3">
            <p className="text-sm font-semibold">Controles de calidad</p>
            <p>
              <Insignia tono={etiquetaControles.tono}>{etiquetaControles.texto}</Insignia>
            </p>
            <Link href={`/hato/${id}/controles`} className={clasesBoton("secundario")}>
              {puedeEscribir(rol, "carne", finca.plan) ? "Responder los controles" : "Ver los controles"}
            </Link>
          </div>
        ) : null}
        {baja.data?.tipo === "sacrificio" && verCarne ? (
          <div className="mt-3 space-y-2 border-t border-arena pt-3">
            <p className="text-sm font-semibold">Canal</p>
            {canal ? (
              <dl className="divide-y divide-arena">
                <Dato etiqueta="Canal caliente">{kg(canal.peso_canal_caliente_kg)}</Dato>
                {canal.rendimiento_caliente_pct != null ? <Dato etiqueta="Rendimiento">{pctUno(canal.rendimiento_caliente_pct)}</Dato> : null}
                {canal.peso_canal_fria_kg != null ? (
                  <Dato etiqueta="Canal fría">
                    {kg(canal.peso_canal_fria_kg)}
                    {canal.rendimiento_frio_pct != null ? ` · ${pctUno(canal.rendimiento_frio_pct)}` : ""}
                  </Dato>
                ) : null}
                {canal.merma_oreo_pct != null ? <Dato etiqueta="Merma al enfriar">{pctUno(canal.merma_oreo_pct)}</Dato> : null}
                {canal.conformacion ? <Dato etiqueta="Conformación">{ETIQUETA_CONFORMACION[canal.conformacion]}</Dato> : null}
                {canal.engrasamiento ? <Dato etiqueta="Engrasamiento">{ETIQUETA_ENGRASAMIENTO[canal.engrasamiento]}</Dato> : null}
                {canal.grasa_dorsal_mm != null ? <Dato etiqueta="Grasa dorsal">{litros(canal.grasa_dorsal_mm)} mm</Dato> : null}
                {canal.grasa_visceral ? <Dato etiqueta="Grasa visceral">{ETIQUETA_GRASA_VISCERAL[canal.grasa_visceral]}</Dato> : null}
                {canal.planta ? <Dato etiqueta="Planta">{canal.planta}</Dato> : null}
              </dl>
            ) : (
              <p className="text-[0.9375rem] text-humo">Todavía no tiene la canal registrada. Con el peso de la canal se calcula el rendimiento.</p>
            )}
            {puedeEscribir(rol, "carne", finca.plan) ? (
              <Link href={canal ? `/carne/canales/${canal.id}` : `/hato/${id}/canal/nuevo`} className={clasesBoton("secundario")}>
                {canal ? "Editar canal" : "Registrar canal"}
              </Link>
            ) : null}
          </div>
        ) : null}
        {puedeGestionar(rol) ? (
          <div className="mt-3">
            <DeshacerBaja animalId={id} etiqueta={animal.nombre ?? animal.numero_arete} esHembra={animal.sexo === "hembra"} />
          </div>
        ) : null}
      </Tarjeta>
    ) : puedeEscribir(rol, "hato", finca.plan) ? (
      <Tarjeta titulo="Salida del hato">
        <p className="text-[0.9375rem] text-humo">
          Si se vendió, murió, se sacrificó o se perdió, regístralo para sacarlo del hato{animal.sexo === "hembra" ? " y del ordeño" : ""}. Puedes deshacerlo después.
        </p>
        <Link href={`/hato/${id}/baja`} className={`${clasesBoton("secundario")} mt-3`}>
          Dar de baja
        </Link>
      </Tarjeta>
    ) : null}
    </>
  );
}
