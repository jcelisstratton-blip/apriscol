"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { Boton, clasesBoton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { Segmentado } from "@/components/Segmentado";
import { Selector } from "@/components/Selector";
import { crearProducto, editarProducto } from "@/app/(app)/sanidad/actions";
import { ETIQUETA_PRODUCTO, TIPOS_PRODUCTO, UNIDADES_DOSIS } from "@/lib/sanidad";
import type { ProductoVeterinario, TipoProducto } from "@/lib/tipos";

/** Agregar un producto al catálogo de la finca (con lo que se sabe de él: retiro y unidad) o corregir uno ya guardado. */
export function FormProducto({ producto }: { producto?: ProductoVeterinario }) {
  const editando = Boolean(producto);
  const [estado, enviar, pendiente] = useActionState(editando ? editarProducto : crearProducto, undefined);
  const [, iniciar] = useTransition();
  const [tipo, setTipo] = useState<TipoProducto>(producto?.tipo ?? "vacuna");
  const [unidad, setUnidad] = useState(producto?.unidad_dosis ?? "");
  const [activo, setActivo] = useState<"true" | "false">(producto?.activo === false ? "false" : "true");

  // Se envía con onSubmit (no con `action`): si hay un error, lo que la persona escribió no se borra.
  const alEnviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    iniciar(() => enviar(datos));
  };

  return (
    <form onSubmit={alEnviar} className="space-y-5">
      {producto ? <input type="hidden" name="producto_id" value={producto.id} /> : null}

      <Campo etiqueta="Nombre del producto">
        {(id) => <input id={id} name="nombre" defaultValue={producto?.nombre} required maxLength={120} autoComplete="off" className={CLASE_INPUT} placeholder="Ej. Clostridial" />}
      </Campo>

      <Campo etiqueta="Tipo">
        {(id) => (
          <Selector
            id={id}
            nombre="tipo"
            valor={tipo}
            onCambio={(v) => v && setTipo(v)}
            titulo="¿Qué tipo de producto es?"
            opciones={TIPOS_PRODUCTO.map((t) => ({ valor: t, etiqueta: ETIQUETA_PRODUCTO[t] }))}
          />
        )}
      </Campo>

      <div className="space-y-3 rounded-3xl border border-arena p-4">
        <p className="font-semibold">Retiro habitual</p>
        <p className="-mt-2 text-[0.8125rem] text-humo">Se propone al registrar una aplicación; ahí se puede cambiar. Déjalo en 0 si no tiene.</p>
        <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2">
          <Campo etiqueta="Leche (días)">
            {(id) => <input id={id} name="retiro_leche_dias" defaultValue={producto?.retiro_leche_dias ?? 0} inputMode="numeric" pattern="[0-9]*" maxLength={3} autoComplete="off" className={CLASE_INPUT} />}
          </Campo>
          <Campo etiqueta="Carne (días)">
            {(id) => <input id={id} name="retiro_carne_dias" defaultValue={producto?.retiro_carne_dias ?? 0} inputMode="numeric" pattern="[0-9]*" maxLength={3} autoComplete="off" className={CLASE_INPUT} />}
          </Campo>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Campo etiqueta="Unidad de la dosis">
          {(id) => (
            <Selector
              id={id}
              nombre="unidad_dosis"
              valor={unidad}
              onCambio={(v) => setUnidad(String(v))}
              titulo="Unidad de la dosis"
              placeholder="Sin especificar"
              permitirVacio
              opciones={UNIDADES_DOSIS.map((u) => ({ valor: u, etiqueta: u }))}
            />
          )}
        </Campo>
        <Campo etiqueta="Registro ICA" ayuda="Opcional.">
          {(id) => <input id={id} name="registro_ica" defaultValue={producto?.registro_ica ?? ""} maxLength={40} autoComplete="off" className={CLASE_INPUT} />}
        </Campo>
      </div>

      {producto ? (
        <div className="space-y-2">
          <span className="block text-sm font-semibold">Estado</span>
          <Segmentado
            etiqueta="Estado del producto"
            nombre="activo"
            valor={activo}
            onCambio={setActivo}
            opciones={[
              { valor: "true", etiqueta: "En uso" },
              { valor: "false", etiqueta: "Archivado" },
            ]}
          />
          <p className="text-[0.8125rem] text-humo">Un producto archivado deja de ofrecerse al registrar aplicaciones, pero el historial no cambia.</p>
        </div>
      ) : null}

      {estado?.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      <div className="space-y-2">
        <Boton type="submit" pendiente={pendiente} cargando="Guardando…">
          {editando ? "Guardar cambios" : "Guardar producto"}
        </Boton>
        <Link href="/sanidad?vista=productos" className={clasesBoton("fantasma")}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
