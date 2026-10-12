import { redirect } from "next/navigation";

/** Las ferias y los premios viven en la ficha de cada animal; esta dirección solo recoge enlaces viejos. */
export default function PaginaFerias() {
  redirect("/hato");
}
