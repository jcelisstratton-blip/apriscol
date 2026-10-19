import { redirect } from "next/navigation";

/** Personal y Equipo son ahora una sola pantalla: los enlaces anteriores llegan a los pagos de Equipo. */
export default function PaginaPersonal() {
  redirect("/mas/miembros?vista=pagos");
}
