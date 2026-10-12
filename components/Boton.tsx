import Link from "next/link";
import { Cargando } from "@/components/Cargando";

type Variante = "primario" | "secundario" | "fantasma" | "peligro";

const BASE =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 text-base font-semibold transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";
const VARIANTES: Record<Variante, string> = {
  primario: "bg-musgo text-sobre-musgo shadow-sm hover:brightness-110",
  secundario: "bg-arena text-tinta hover:brightness-95",
  fantasma: "text-musgo hover:bg-arena/60",
  peligro: "bg-rojo text-papel hover:brightness-110",
};

export function clasesBoton(variante: Variante = "primario", ancho = true) {
  return `${BASE} ${VARIANTES[variante]} ${ancho ? "w-full" : ""}`;
}

export function Boton({
  variante = "primario",
  ancho = true,
  pendiente = false,
  cargando = "Guardando…",
  className = "",
  disabled,
  children,
  ...resto
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: Variante;
  ancho?: boolean;
  pendiente?: boolean;
  cargando?: string;
}) {
  return (
    <button className={`${clasesBoton(variante, ancho)} ${className}`} {...resto} disabled={pendiente || disabled}>
      {pendiente ? <Cargando pequeno texto={cargando} /> : children}
    </button>
  );
}

export function EnlaceBoton({
  href,
  variante = "primario",
  ancho = true,
  className = "",
  children,
}: {
  href: string;
  variante?: Variante;
  ancho?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={`${clasesBoton(variante, ancho)} ${className}`}>
      {children}
    </Link>
  );
}
