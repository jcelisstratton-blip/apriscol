"use client";

import { CamposSementalExterno } from "@/components/CamposSementalExterno";
import { Segmentado } from "@/components/Segmentado";
import { SelectorAnimal } from "@/components/SelectorAnimal";
import type { DatosExterno } from "@/lib/semental-externo";
import type { Especie } from "@/lib/tipos";

export type OrigenSemental = "propio" | "externo";
type Ref = { id: string; numero_arete: string; nombre: string | null; fecha_nacimiento?: string | null };

/**
 * ¿De dónde viene el semental? De tu hato (se elige de la lista) o de otro hato, prestado (se piden sus datos: chip, nombre, hato de origen,
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
  /** Si el selector va dentro de un formulario, el nombre de los campos que viajan con él. */
  nombreOrigen?: string;
  nombreMacho?: string;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <p className="text-sm font-semibold">Semental</p>
        <Segmentado<OrigenSemental>
          nombre={nombreOrigen}
          etiqueta="Origen del semental"
          valor={origen}
          onCambio={onOrigen}
          opciones={[
            { valor: "propio", etiqueta: "De mi hato" },
            { valor: "externo", etiqueta: "De otro hato" },
          ]}
        />
      </div>
      {origen === "propio" ? (
        <SelectorAnimal key={especie} nombre={nombreMacho ?? "semental"} fincaId={fincaId} sexo="macho" especie={especie} titulo="Elegir semental" valor={macho} onCambio={onMacho} vacio="Elegir un macho de tu hato" />
      ) : (
        <CamposSementalExterno valor={externo} onCambio={onExterno} finTemporada={finTemporada} />
      )}
    </div>
  );
}
