import { ChipEnlace } from "@/components/ChipEnlace";
import { FilaDesplazable } from "@/components/FilaDesplazable";
import { direccionHato, filtrosHato, type VistaHato } from "@/lib/hato";
import type { Especie } from "@/lib/tipos";

/** Los chips del Hato dentro de una vista de trabajo: los filtros de animales (que vuelven a la lista) y las vistas, con la actual marcada. */
export function ChipsHato({ especies, vistas, activa }: { especies: Especie[]; vistas: VistaHato[]; activa: VistaHato["id"] }) {
  return (
    <FilaDesplazable>
      {filtrosHato(especies).map((f) => (
        <ChipEnlace key={f.id} href={direccionHato(f.id)} activo={false}>
          {f.texto}
        </ChipEnlace>
      ))}
      {vistas.map((v) => (
        <ChipEnlace key={v.id} href={v.href} activo={v.id === activa}>
          {v.texto}
        </ChipEnlace>
      ))}
    </FilaDesplazable>
  );
}
