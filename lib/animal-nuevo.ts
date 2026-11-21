import { z } from "zod";
import { leerNumero } from "@/lib/numeros";
import { opcional } from "@/lib/validacion";
import type { Especie } from "@/lib/tipos";

/**
 * Las reglas de un animal nuevo, en un solo lugar: las usan el formulario con señal (`crearAnimal`, `app/(app)/hato/actions.ts`) y el registro
 * sin señal (`guardarAnimalCampo`, `lib/campo-servidor.ts`). Ambos reciben los mismos campos de texto del formulario y llaman a la misma función de
 * la base (`registrar_animal`), que es todo o nada e idempotente por `client_request_id`.
 */
export const esquemaAnimal = z.object({
  especie: z.enum(["caprino", "ovino"]),
  numero_arete: z.string().trim().min(1, "El número de arete es obligatorio.").max(40),
  nombre: opcional(z.string().trim().max(60)),
  sexo: z.enum(["hembra", "macho"]),
  raza_id: opcional(z.coerce.number().int().positive()),
  fecha_nacimiento: opcional(z.iso.date("La fecha de nacimiento no es válida.")),
  fecha_nacimiento_aprox: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
  padre_id: opcional(z.uuid()),
  madre_id: opcional(z.uuid()),
  padre_externo: opcional(z.string().trim().max(80)),
  madre_externa: opcional(z.string().trim().max(80)),
  origen: z.enum(["nacido_en_finca", "comprado"]),
  vocacion: z.enum(["leche", "carne", "doble"]),
  uso_macho: opcional(z.enum(["reproductor", "carne", "por_definir"])),
  /** Solo ovejas: lana o pelo. Vacío = la de su raza. */
  cobertura: opcional(z.enum(["lana", "pelo", "segun_raza"])),
  chip: opcional(z.string().trim().max(40, "El microchip es muy largo.")),
  color: opcional(z.string().trim().max(60, "El color es muy largo.")),
  marcas: opcional(z.string().trim().max(120, "Las marcas son muy largas.")),
  rasgos: opcional(z.string().trim().max(200, "Los rasgos son muy largos.")),
  peso_nacer_kg: z.preprocess(
    (v) => (typeof v === "string" ? v.replace(",", ".") : v),
    opcional(z.coerce.number("El peso al nacer debe ser un número.").min(0.1, "El peso al nacer debe estar entre 0,1 y 15 kg.").max(15, "El peso al nacer debe estar entre 0,1 y 15 kg.")),
  ),
  valor_compra: z.preprocess(
    (v) => (typeof v === "string" ? (leerNumero(v) ?? v) : v),
    opcional(z.number("El valor debe ser un número.").min(0, "El valor no puede ser negativo.").max(99_999_999_999, "El valor es demasiado grande. Revísalo.")),
  ),
  /** Cuándo se compró (solo animales comprados): la compra cuenta como costo en esa fecha. */
  fecha_compra: opcional(z.iso.date("La fecha de compra no es válida.")),
  notas: opcional(z.string().trim().max(1000, "Las notas son muy largas.")),
  fecha_ultimo_parto: opcional(z.iso.date("La fecha del parto no es válida.")),
  foto_path: opcional(z.string().max(200)),
  client_request_id: opcional(z.uuid()),
});

/** La ruta de una foto de animal debe estar en la carpeta de esta finca (la base también lo exige). */
export const fotoValida = (ruta: string | undefined, fincaId: string) => !ruta || new RegExp(`^${fincaId}/[0-9a-f-]{36}\\.(jpg|png|webp)$`).test(ruta);


export type DatosAnimal = z.output<typeof esquemaAnimal>;

/**
 * Deja listos los datos para `registrar_animal`: un macho no tiene aptitud (se guarda «carne» solo por ser obligatoria) sino un uso; el peso al nacer
 * solo aplica a los nacidos en la finca; la cobertura solo a las ovejas; y el último parto, solo a una hembra y después de su nacimiento.
 */
export function prepararAnimalNuevo(datos: DatosAnimal, especiesFinca: readonly Especie[]): { error: string } | { animal: Record<string, unknown>; fechaUltimoParto: string | null } {
  const { fecha_ultimo_parto, uso_macho, ...animal } = datos;
  if (animal.sexo === "macho") animal.vocacion = "carne";
  const usoMacho = animal.sexo === "macho" && uso_macho && uso_macho !== "por_definir" ? uso_macho : null;
  if (animal.origen === "comprado") animal.peso_nacer_kg = undefined;
  if (!especiesFinca.includes(animal.especie)) return { error: "Esa especie no está activa en tu finca." };
  if (fecha_ultimo_parto && animal.sexo !== "hembra") return { error: "Solo una hembra puede tener un parto." };
  if (fecha_ultimo_parto && animal.fecha_nacimiento && fecha_ultimo_parto <= animal.fecha_nacimiento) return { error: "El parto debe ser posterior al nacimiento de la hembra." };
  const cobertura = animal.especie === "ovino" && (animal.cobertura === "lana" || animal.cobertura === "pelo") ? animal.cobertura : null;
  return { animal: { ...animal, uso_macho: usoMacho, cobertura }, fechaUltimoParto: fecha_ultimo_parto ?? null };
}
