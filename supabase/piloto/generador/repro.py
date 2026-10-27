"""Reproducción del piloto: servicios, diagnósticos, partos (con sus crías), lactancias y celos de los últimos 12 meses. Datos FICTICIOS."""
from __future__ import annotations

import datetime as dt

import sim
from sim import A, HOY, T0
from hato import rnd, dias_gest, lactancias, partos_previos, DIAS

VET = "Andrés Zapata"
SEMEN_EXTERNO = ["Semental Saanen «Alpes» (pajilla)", "Semental Alpino «Mont Blanc» (pajilla)", "Semental Toggenburg «Heidi Valley» (pajilla)"]


def d(x: dt.date) -> str:
    return x.isoformat()


def elegir_semental(a: A, s: dt.date, res):
    """Reproductor vivo en la fecha del servicio con parentesco bajo con la hembra; si no hay, pajilla de fuera."""
    phi = res["phi"]
    r = rnd("padre-actual", a.clave, s)
    cand = [x for x in res["todos"] if x.especie == a.especie and not x.es_h and x.vivo(s) and x.uso_macho == "reproductor"
            and x.edad_dias(s) >= 240 and phi(x, a) <= 0.07]
    if not cand or r.random() < 0.15:
        return None
    return r.choice(cand)


def construir(res) -> dict:
    todos: list[A] = res["todos"]
    filas = []         # una fila por gestación (servicio → diagnóstico → parto → crías) o por servicio fallido
    lact_pre = []      # lactancias abiertas al momento de la adopción (parto anterior a T0)
    lact_upd = []      # fecha de secado de las lactancias que abre un parto de la ventana
    celos = []
    emitidas = {a.clave for a in res["emitir"]}
    rng = rnd("repro-global")

    abortos = {"n": 0}
    hembras = [a for a in todos if a.es_h and a.clave in emitidas]
    prefijo_semen = 0
    for a in hembras:
        g = dias_gest(a)
        partos = sorted([p for p in a.partos if p[0] >= T0], key=lambda p: p[0])
        previo = max([p[0] for p in a.partos if p[0] < T0], default=None)
        ultimo = previo
        # lactancia abierta a T0 (parto anterior)
        for l in lactancias(a):
            if l["parto"] < T0 and l["secado_plan"] >= T0 and a.baja is None or (l["parto"] < T0 and l["secado_plan"] >= T0 and a.baja and a.baja["fecha"] >= T0):
                n = partos_previos(a) or 1
                lact_pre.append([a.clave, n, d(l["parto"]), d(l["secado_plan"]) if l["secado_plan"] <= HOY else None])
        for f, crias, padre in partos:
            s = f - DIAS(days=g)
            r = rnd("svc", a.clave, f)
            # servicio fallido previo
            if r.random() < 0.2:
                sf = s - DIAS(days=r.randint(28, 50))
                if ultimo is None or sf > ultimo + DIAS(days=25):
                    dxf = sf + DIAS(days=r.randint(35, 45))
                    if dxf < s - DIAS(days=3):
                        macho = padre
                        filas.append([a.clave, d(sf), "monta_natural", macho.clave if macho else None, None, None, d(dxf), "vacia", "ecografia", None, None, None, round(r.uniform(2.5, 3.5) * 2) / 2, None, None, None, None])
            # aborto sembrado (a lo sumo 2 en el hato): una preñez anterior que se perdió y por eso el siguiente parto vino tarde
            if a.especie == "caprino" and ultimo is not None and (s - ultimo).days >= 135 and abortos["n"] < 2 and r.random() < .9:
                sa = ultimo + DIAS(days=25)
                ab = sa + DIAS(days=r.randint(80, 90))
                if ab + DIAS(days=20) < s and ab >= T0 + DIAS(days=10):
                    abortos["n"] += 1
                    dxa = sa + DIAS(days=50)
                    filas.append([a.clave, d(sa), "monta_natural", (padre.clave if padre else None), None, None, d(dxa), "gestante", "ecografia", 50, 1, None, 3.0,
                                  d(ab), "aborto", r.choice(["nutricional", "infecciosa"]), []])
                    ultimo = ab
            # servicio exitoso
            tipo = "monta_natural"
            macho, ext, lote = (padre.clave if padre else None), None, None
            if padre is None or r.random() < 0.08:
                tipo, macho, ext, lote = "inseminacion", None, r.choice(SEMEN_EXTERNO), f"PAJ-{r.randint(1000, 9999)}"
            dx_f = s + DIAS(days=r.randint(45, 60))
            metodo = "ecografia" if (a.especie == "caprino" and r.random() < .7) or r.random() < .3 else "palpacion"
            fetos = min(len(crias), 4) if crias else 1
            dx = [d(dx_f), "gestante", metodo, (dx_f - s).days if metodo == "ecografia" else None, fetos if metodo == "ecografia" else None,
                  "llenado_uterino" if metodo == "palpacion" else None, round(r.uniform(2.5, 3.5) * 2) / 2]
            tipo_parto = "normal"
            x = r.random()
            if x < .07: tipo_parto = "asistido"
            elif x < .09: tipo_parto = "cesarea"
            if f > HOY: continue
            fila = [a.clave, d(s), tipo, macho, ext, lote] + dx + [d(f), tipo_parto, None,
                   [[c.clave, c.sexo, c.peso_nacer] for c in crias]]
            filas.append(fila)
            if lactancias(a) and a.vivo(f):
                pass
            ultimo = f
        # secado de las lactancias que abre un parto de la ventana
        for l in lactancias(a):
            if l["parto"] >= T0 and l["secado"] is not None:
                lact_upd.append([a.clave, d(l["parto"]), d(l["secado"])])
        # preñez en curso: servicio ya hecho cuyo parto cae después de hoy
        if a.baja is None and a.proximo_parto and (a.proximo_parto - DIAS(days=g)) <= HOY and a.proximo_parto > HOY:
            s = a.proximo_parto - DIAS(days=g)
            if ultimo is None or s > ultimo + DIAS(days=20):
                r = rnd("svc-actual", a.clave, s)
                m = elegir_semental(a, s, res)
                tipo = "monta_natural" if m else "inseminacion"
                dx_f = s + DIAS(days=r.randint(45, 60))
                dx = [None] * 7
                if dx_f <= HOY:
                    metodo = "ecografia" if r.random() < .6 else "palpacion"
                    dx = [d(dx_f), "gestante", metodo, (dx_f - s).days if metodo == "ecografia" else None, 1 + (r.random() < .45) if metodo == "ecografia" else None,
                          "llenado_uterino" if metodo == "palpacion" else None, round(r.uniform(2.5, 3.5) * 2) / 2]
                filas.append([a.clave, d(s), tipo, m.clave if m else None, None if m else r.choice(SEMEN_EXTERNO), None if m else f"PAJ-{r.randint(1000, 9999)}"] + dx + [None, None, None, None])

    # Casos sembrados sobre preñeces en curso (la fila de «preñez en curso» se reemplaza):
    #  · parto atrasado: servida hace 165 días, gestante por ecografía, y ya pasó la fecha prevista sin registrar el parto
    #  · diagnóstico pendiente: servida hace 75 días y nadie la ha revisado
    ultimo_parto = {a.clave: max([p[0] for p in a.partos], default=None) for a in todos}
    en_curso = [f for f in filas if f[13] is None and f[6] is not None and f[1] >= d(HOY - DIAS(days=150))]
    en_curso = [f for f in en_curso if ultimo_parto.get(f[0]) and 250 <= (HOY - ultimo_parto[f[0]]).days <= 330]
    if len(en_curso) >= 2:
        a1, a2 = en_curso[0], en_curso[1]
        filas.remove(a1)
        filas.remove(a2)
        s1 = HOY - DIAS(days=165)
        filas.append([a1[0], d(s1), "monta_natural", None, SEMEN_EXTERNO[0], "PAJ-4417", d(s1 + DIAS(days=52)), "gestante", "ecografia", 52, 1, None, 3.0, None, None, None, None])
        filas.append([a2[0], d(HOY - DIAS(days=75)), "monta_natural", None, SEMEN_EXTERNO[1], "PAJ-5120", None, None, None, None, None, None, None, None, None, None, None])
    filas.sort(key=lambda x: (x[1], x[0]))
    # celos: se observan el día del servicio o el anterior (en el 40 % de los servicios)
    for f in filas:
        r = rnd("celo", f[0], f[1])
        if r.random() < .4:
            dia = dt.date.fromisoformat(f[1]) - DIAS(days=r.randint(0, 1))
            celos.append([f[0], d(dia), r.choice(["Inquieta y moviendo la cola", "Aceptó la monta", "Flujo claro, busca al macho", "Balido frecuente", "Se deja montar por las otras"])])
    return dict(filas=filas, lact_pre=lact_pre, lact_upd=lact_upd, celos=celos)


if __name__ == "__main__":
    import hato
    r = sim.simular(hato.SEED)
    o = construir(r)
    print({k: len(v) for k, v in o.items()})
    print(o["filas"][0]); print(o["filas"][-1]); print(o["lact_pre"][:3])
