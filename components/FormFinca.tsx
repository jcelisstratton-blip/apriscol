"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { Boton, clasesBoton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { CamposUbicacion } from "@/components/CamposUbicacion";
import { Segmentado } from "@/components/Segmentado";
import { SubirFoto } from "@/components/SubirFoto";
import { urlLogo } from "@/lib/logo-finca";
import type { Especie, Vocacion } from "@/lib/tipos";
import { crearFinca, editarFinca, prepararSubidaLogo } from "@/app/onboarding/actions";

export type FincaEditable = {
  id: string;
  nombre: string;
  departamento: string | null;
  municipio: string | null;
  vereda: string | null;
  proposito: Vocacion;
  especies: Especie[];
  logo_path: string | null;
};

/** Crear una finca (al registrarse o al agregar otra) o corregir los datos de la finca activa. */
export function FormFinca({ finca, especiesEnUso = [] }: { finca?: FincaEditable; especiesEnUso?: Especie[] }) {
  const editando = Boolean(finca);
  const [estado, enviar, pendiente] = useActionState(editando ? editarFinca : crearFinca, undefined);
  const [, iniciar] = useTransition();
  const [proposito, setProposito] = useState<Vocacion>(finca?.proposito ?? "leche");
  const [especies, setEspecies] = useState<Especie[]>(finca?.especies ?? ["caprino"]);
  const [subiendoLogo, setSubiendoLogo] = useState(false);
  const logoActual = finca ? urlLogo(finca) : null;

  const alternar = (e: Especie) =>
    setEspecies((previas) => (previas.includes(e) ? previas.filter((x) => x !== e) : [...previas, e]));

  // Se envía con onSubmit (no con `action`): si hay un error, lo que la persona escribió no se borra.
  const alEnviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    iniciar(() => enviar(datos));
  };

  return (
    <form onSubmit={alEnviar} className="space-y-5">
      <Campo etiqueta="Nombre de la finca">
        {(id) => <input id={id} name="nombre" defaultValue={finca?.nombre} required minLength={2} maxLength={120} autoComplete="off" className={CLASE_INPUT} placeholder="Ej. El Mirador" />}
      </Campo>

      {editando && finca ? (
        <div className="space-y-2">
          <span className="block text-sm font-semibold">Logo de la finca</span>
          <SubirFoto
            nombre="logo_path"
            bucket="logos-fincas"
            preparar={prepararSubidaLogo}
            forma="logo"
            etiqueta="Logo de la finca"
            textoAgregar="Agregar el logo"
            onEstado={setSubiendoLogo}
            inicial={finca.logo_path && logoActual ? { path: finca.logo_path, url: logoActual } : null}
          />
          <p className="text-[0.8125rem] text-humo">Opcional. Se ve junto al nombre de tu finca en el menú y al cambiar de finca.</p>
        </div>
      ) : null}

      <CamposUbicacion departamentoInicial={finca ? (finca.departamento ?? "") : "Antioquia"} municipioInicial={finca?.municipio ?? ""} />

      <Campo etiqueta="Vereda" ayuda="Opcional.">
        {(id) => <input id={id} name="vereda" defaultValue={finca?.vereda ?? ""} maxLength={80} autoComplete="off" className={CLASE_INPUT} />}
      </Campo>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">¿Qué animales tienes?</legend>
        <div className="grid grid-cols-2 gap-2">
          {(["caprino", "ovino"] as const).map((e) => {
            const activo = especies.includes(e);
            const enUso = editando && especiesEnUso.includes(e);
            return (
              <button
                key={e}
                type="button"
                aria-pressed={activo}
                disabled={enUso}
                onClick={() => alternar(e)}
                className={`min-h-14 rounded-2xl border-2 px-3 text-base font-semibold transition disabled:cursor-not-allowed ${
                  activo ? "border-musgo bg-musgo/10 text-musgo-osc" : "border-arena bg-papel text-humo"
                }`}
              >
                {e === "caprino" ? "Cabras" : "Ovejas"}
              </button>
            );
          })}
        </div>
        {editando && especiesEnUso.length > 0 ? (
          <p className="text-[0.8125rem] text-humo">Una especie con animales registrados no se puede quitar.</p>
        ) : null}
        {especies.map((e) => (
          <input key={e} type="hidden" name="especies" value={e} />
        ))}
      </fieldset>

      <div className="space-y-2">
        <span className="block text-sm font-semibold">¿Para qué las manejas?</span>
        <Segmentado
          etiqueta="Propósito"
          nombre="proposito"
          valor={proposito}
          onCambio={setProposito}
          opciones={[
            { valor: "leche", etiqueta: "Leche" },
            { valor: "carne", etiqueta: "Carne" },
            { valor: "doble", etiqueta: "Ambos" },
          ]}
        />
      </div>

      {estado?.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}

      <div className="space-y-2">
        <Boton type="submit" pendiente={pendiente} cargando={editando ? "Guardando cambios…" : "Creando tu finca…"} disabled={especies.length === 0 || subiendoLogo}>
          {editando ? "Guardar cambios" : "Crear finca"}
        </Boton>
        {editando ? (
          <Link href="/mas" className={clasesBoton("fantasma")}>
            Cancelar
          </Link>
        ) : null}
      </div>
    </form>
  );
}
