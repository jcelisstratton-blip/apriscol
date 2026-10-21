import type { Metadata } from "next";
import { Encabezado } from "@/components/Encabezado";
import { ListaAuditoria } from "@/components/ListaAuditoria";

export const metadata: Metadata = { title: "Bitácora" };

/** Bitácora de solo lectura: cada pago confirmado o anulado, vigencia fijada y cuenta de pruebas, con quién lo hizo y cuándo. */
export default function PaginaAuditoria() {
  return (
    <>
      <Encabezado titulo="Bitácora" subtitulo="Qué se hizo, quién y cuándo" />
      <ListaAuditoria />
    </>
  );
}
