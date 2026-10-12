"use client";

import { CamposSementalExterno } from "@/components/CamposSementalExterno";
import { SelectorAnimal } from "@/components/SelectorAnimal";
import { SelectorTarjetas } from "@/components/SelectorTarjetas";
import { ESCENA_ORIGEN_SEMENTAL } from "@/lib/escenas-forms-b-reproduccion";
import type { DatosExterno } from "@/lib/semental-externo";
import type { Especie, Raza } from "@/lib/tipos";

export type OrigenSemental = "propio" | "externo";
type Ref = { id: string; numero_arete: string; nombre: string | null; fecha_nacimiento?: string | null };

/**
 * ¿De dónde viene el semental? «Semental de mi hato» (se elige de la lista) o «Semental externo», prestado por otro hato (se piden sus datos: chip, nombre, hato de origen,
 * propietario, préstamo, sanidad…). Lo usan la creación de la temporada y «Agregar semental».
 */
export function OrigenYSemental({
  fincaId,
  especie,
  origen,
  onOrigen,
  macho,
  onMacho,
  externo,
  onExterno,
  finTemporada,
  razas,
  nombreOrigen,
  nombreMacho,
}: {
  fincaId: string;
  especie: Especie;
  origen: OrigenSemental;
  onOrigen: (o: OrigenSemental) => void;
  macho: Ref | null;
  onMacho: (m: Ref | null) => void;
  externo: DatosExterno;
  onExterno: (d: DatosExterno) => void;
  finTemporada?: string | null;
  razas: Raza[];
  /** Si el selector va dentro de un formulario, el nombre de los campos que viajan con él. */
  nombreOrigen?: string;
  nombreMacho?: string;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <p className="text-sm font-semibold">¿De dónde viene el semental?</p>
        <SelectorTarjetas<OrigenSemental>
          nombre={nombreOrigen}
          titulo="Origen del semental"
          valor={origen}
          onCambio={(v) => v && onOrigen(v)}
          opciones={[
            { valor: "propio", etiqueta: "Semental de mi hato", detalle: "Eliges un macho que ya está en tu hato.", escena: ESCENA_ORIGEN_SEMENTAL.propio },
            { valor: "externo", etiqueta: "Semental externo", detalle: "Lo presta otro hato. Te pedimos sus datos y los del préstamo.", escena: ESCENA_ORIGEN_SEMENTAL.externo },
          ]}
        />
      </div>
      {origen === "propio" ? (
        <SelectorAnimal key={especie} nombre={nombreMacho ?? "semental"} fincaId={fincaId} sexo="macho" especie={especie} titulo="Elegir semental" valor={macho} onCambio={onMacho} vacio="Elegir un macho de tu hato" />
      ) : (
        <CamposSementalExterno valor={externo} onCambio={onExterno} finTemporada={finTemporada} especie={especie} razas={razas} />
      )}
    </div>
  );
}
