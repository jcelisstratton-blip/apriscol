"use client";

import { Aviso } from "@/components/Aviso";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { capacidadSemental, ETIQUETA_CAPACIDAD, leerNumeroHembras, mesesDesde } from "@/lib/empadronamiento";
import type { Especie } from "@/lib/tipos";

/**
 * «¿Cuántas hembras tendrá este semental?»: el número que la persona decide para cada semental de la temporada (es obligatorio y exacto).
 * Debajo dice cuál es el máximo recomendado para ese semental (por especie y edad) y, si se pasa de él, lo avisa sin impedirlo.
 */
export function CampoNumeroHembras({
  valor,
  onCambio,
  especie,
  nacimiento,
  minimo = 0,
  nombre = "num_hembras",
  etiqueta = "¿Cuántas hembras tendrá este semental?",
}: {
  valor: string;
  onCambio: (v: string) => void;
  especie: Especie;
  /** Fecha de nacimiento del semental: de su edad sale el máximo recomendado. */
  nacimiento?: string | null;
  /** Las hembras que el semental ya tiene: el número no puede ser menor. */
  minimo?: number;
  nombre?: string;
  etiqueta?: string;
}) {
  const cap = capacidadSemental(especie, mesesDesde(nacimiento ?? null), null);
  const n = leerNumeroHembras(valor);
  const escrito = valor.trim() !== "";
  return (
    <div className="space-y-2">
      <Campo
        etiqueta={etiqueta}
        ayuda={`Máximo recomendado para este semental: ${cap.max} hembras (${ETIQUETA_CAPACIDAD[cap.origen]}${nacimiento ? "" : "; sin fecha de nacimiento se toma la guía del joven"}). El número que escribas es exacto: la app no deja asignarle ni una más.`}
      >
        {(id) => (
          <input
            id={id}
            name={nombre}
            value={valor}
            onChange={(e) => onCambio(e.target.value)}
            inputMode="numeric"
            autoComplete="off"
            required
            placeholder={`Hasta ${cap.max}`}
            className={CLASE_INPUT}
          />
        )}
      </Campo>
      {escrito && n == null ? <Aviso tipo="error">Escribe un número entero de hembras, entre 1 y 100.</Aviso> : null}
      {n != null && n < minimo ? <Aviso tipo="error">Este semental ya tiene {minimo} {minimo === 1 ? "hembra" : "hembras"}: el número no puede ser menor.</Aviso> : null}
      {n != null && n > cap.max ? (
        <Aviso tipo="atencion">
          {n} hembras es más de lo recomendado para un {ETIQUETA_CAPACIDAD[cap.origen]} (máximo {cap.max}). Con tantas hembras baja la fertilidad del grupo y algunas pueden quedar vacías. Puedes seguir si es lo que quieres.
        </Aviso>
      ) : null}
    </div>
  );
}
