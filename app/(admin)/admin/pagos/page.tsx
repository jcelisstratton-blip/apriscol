import type { Metadata } from "next";
import { Encabezado } from "@/components/Encabezado";
import { ListaPagos } from "@/components/ListaPagos";

export const metadata: Metadata = { title: "Pagos" };

/** Registro de pagos confirmados: quién, cuánto, con qué referencia y cuándo. Se anula el último pago de una finca si se confirmó por error. */
export default function PaginaPagos() {
  return (
    <>
      <Encabezado titulo="Pagos" subtitulo="Lo que se ha confirmado y activado" />
      <ListaPagos />
    </>
  );
}
