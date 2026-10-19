import { redirect } from "next/navigation";

/** A las personas nuevas se las agrega en Equipo, al elegir su perfil y su contrato. */
export default function PaginaPersonaNueva() {
  redirect("/mas/miembros");
}
