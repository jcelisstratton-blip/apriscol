import type { ContextoReporte } from "@/lib/reportes/base";
import { informeGestantes } from "@/lib/reportes/informes/gestantes";
import { informeInvAlimento } from "@/lib/reportes/informes/inv-alimento";
import { informeInvLotes } from "@/lib/reportes/informes/inv-lotes";
import { informeInvMedicamentos } from "@/lib/reportes/informes/inv-medicamentos";
import { informeInvMovAlimento } from "@/lib/reportes/informes/inv-mov-alimento";
import { informeInvMovMed } from "@/lib/reportes/informes/inv-mov-med";
import { informeInventario } from "@/lib/reportes/informes/inventario";
import { informeOrdeno } from "@/lib/reportes/informes/ordeno";
import { informePartos } from "@/lib/reportes/informes/partos";
import { informePeso } from "@/lib/reportes/informes/peso";
import { informePorPalpar } from "@/lib/reportes/informes/por-palpar";
import { informeRetiro } from "@/lib/reportes/informes/retiro";
import { informeSalidas } from "@/lib/reportes/informes/salidas";
import { informeSanidad } from "@/lib/reportes/informes/sanidad";
import { informeSementales } from "@/lib/reportes/informes/sementales";
import { informeVacias } from "@/lib/reportes/informes/vacias";
import type { ReporteId, ResultadoReporte } from "@/lib/reportes/tipos";

const INFORMES: Record<ReporteId, (c: ContextoReporte) => Promise<ResultadoReporte>> = {
  inventario: informeInventario,
  salidas: informeSalidas,
  vacias: informeVacias,
  por_palpar: informePorPalpar,
  gestantes: informeGestantes,
  partos: informePartos,
  sementales: informeSementales,
  ordeno: informeOrdeno,
  peso: informePeso,
  retiro: informeRetiro,
  sanidad: informeSanidad,
  inv_medicamentos: informeInvMedicamentos,
  inv_lotes: informeInvLotes,
  inv_mov_med: informeInvMovMed,
  inv_alimento: informeInvAlimento,
  inv_mov_alimento: informeInvMovAlimento,
};

/** Arma un reporte con los datos de la finca y los filtros del contexto. */
export const generarReporte = (id: ReporteId, c: ContextoReporte): Promise<ResultadoReporte> => INFORMES[id](c);
