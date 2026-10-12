import { z } from "zod";
import { leerNumero } from "@/lib/numeros";

/** Piezas de validación de formularios compartidas por las acciones de servidor. */
const vacio = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

/** Un campo que puede venir vacío («» = no se llenó). */
export const opcional = <T extends z.ZodType>(s: T) => z.preprocess(vacio, s.optional());

/** Un número escrito a la colombiana («3,6», «2.500»); lo que no se entiende queda como texto y la validación lo rechaza. */
export const decimal = (s: z.ZodType<number>) => z.preprocess((v) => (typeof v === "string" ? (leerNumero(v) ?? v) : v), opcional(s));

export const texto = (max: number, mensaje: string) => opcional(z.string().trim().max(max, mensaje));
