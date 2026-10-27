"""Derivados del hato simulado: lactancias, ubicación (corrales y potreros), chips, señas y capacidades. Datos FICTICIOS y deterministas."""
from __future__ import annotations

import datetime as dt
import random

import sim
from sim import A, HOY, T0, VOCACION

SIN_CUARENTENA = "MIR-C0351"   # «Bambi»: compra reciente que NO hizo cuarentena (para mostrar la alerta)
SEED = 55          # semilla del piloto (115 animales vivos, dos hembras con endogamia 0,25)
DIAS = dt.timedelta


def rnd(*partes) -> random.Random:
    """Generador determinista por animal y evento (no depende del orden de ejecución)."""
    return random.Random("|".join(str(p) for p in partes))


def dias_gest(a: A) -> int:
    return 150 if a.especie == "caprino" else 147


# ── lactancias ───────────────────────────────────────────────────────────────────────────────────────────────
def lactancias(a: A) -> list[dict]:
    """Lactancias de una cabra: [{parto, secado_plan, secado}], con `secado` = None si sigue en leche a HOY. Solo cabras (las ovejas no se ordeñan)."""
    if a.especie != "caprino" or not a.es_h or VOCACION[a.raza] not in ("leche", "doble"): return []
    partos = sorted(a.partos, key=lambda p: p[0])
    out = []
    for i, (f, crias, padre) in enumerate(partos):
        sig = partos[i + 1][0] if i + 1 < len(partos) else a.proximo_parto
        r = rnd("lact", a.clave, f)
        fin = f + DIAS(days=r.randint(250, 305))
        if sig: fin = min(fin, sig - DIAS(days=r.randint(50, 65)))
        fin = max(fin, f + DIAS(days=120))
        if a.baja and a.baja["fecha"] < fin: fin = a.baja["fecha"]
        out.append(dict(parto=f, secado_plan=fin, secado=fin if fin <= HOY else None, num=i))
    return out


def partos_previos(a: A) -> int | None:
    """Partos antes de usar Apriscol (T0): los simulados anteriores a T0 más los que tuvo antes de comprarla."""
    if not a.es_h: return None
    if a.nac >= T0: return None
    antes = sum(1 for f, c, p in a.partos if f < T0)
    extra = 0
    if a.origen == "comprado":
        extra = rnd("prev", a.clave).randint(0, 2) if (a.compra - a.nac).days > 600 else 0
    return antes + extra


# ── ubicación ────────────────────────────────────────────────────────────────────────────────────────────────
CLAVES = ["ORDENO", "ALTA", "SECAS", "MATER", "CRIAS", "CUAR", "SEMEN", "CEBA", "REEMP", "OVEJAS", "POT_K1", "POT_K2", "POT_O1", "POT_O2"]
NOMBRE_UBIC = {"ORDENO": "Sala de ordeño y espera", "ALTA": "Corral alta producción", "SECAS": "Corral de secas", "MATER": "Maternidad", "CRIAS": "Corral de crías",
               "CUAR": "Cuarentena", "SEMEN": "Sementales", "CEBA": "Corral de ceba", "REEMP": "Corral de reemplazos", "OVEJAS": "Corral de ovejas",
               "POT_K1": "Potrero kikuyo 1", "POT_K2": "Potrero kikuyo 2", "POT_O1": "Potrero ovinos 1", "POT_O2": "Potrero ovinos 2"}


def es_adulta(a: A, d: dt.date) -> bool:
    return a.es_h and (a.edad_dias(d) >= 330 or a.destino == "cria")


def ubic_base(a: A, d: dt.date) -> str:
    e = a.edad_dias(d)
    if a.especie == "ovino":
        if not a.es_h and a.uso_macho == "reproductor" and e > 300: return "SEMEN"
        if not a.es_h and e >= 120: return "CEBA"
        return "OVEJAS"
    if a.es_h:
        if e < 100: return "CRIAS"
        if not es_adulta(a, d): return "REEMP"
        # adulta: maternidad alrededor del parto, secas, o alta producción
        for f, c, p in a.partos:
            if abs((d - f).days) <= 6: return "MATER"
        if a.proximo_parto and 0 <= (a.proximo_parto - d).days <= 6: return "MATER"
        lacts = lactancias(a)
        for l in lacts:
            if l["parto"] <= d <= l["secado_plan"]: return "ALTA"
        # sin lactancia vigente: secas (o reemplazo si nunca ha parido)
        return "SECAS" if a.partos else "REEMP"
    if a.uso_macho == "reproductor" and e > 300: return "SEMEN"
    if e < 100: return "CRIAS"
    return "CEBA"


def ubic(a: A, d: dt.date) -> str:
    b = ubic_base(a, d)
    if a.especie == "ovino" and b in ("OVEJAS",):
        if d >= HOY - DIAS(days=3): return "POT_O1"
        k = (d - (HOY - DIAS(days=120))).days
        if k >= 0:
            c = k % 35
            if c < 5: return "POT_O1"
            if c < 10: return "POT_O2"
        return "OVEJAS"
    if a.especie == "caprino" and b in ("REEMP", "CEBA") and d >= HOY - DIAS(days=8): return "POT_K1"
    return b


def segmentos(a: A) -> list[tuple[str, dt.date, dt.date | None, str]]:
    """Movimientos del animal desde T0 (o su nacimiento/compra) hasta hoy o su baja: (clave, desde, hasta|None, motivo)."""
    reciente = a.origen == "comprado" and a.compra and a.compra > T0
    inicio = a.compra if reciente else max(T0, a.nac)
    fin = a.baja["fecha"] if a.baja and a.baja["fecha"] >= T0 else None
    if inicio > HOY or (fin is not None and fin < inicio): return []
    ultimo = fin if fin else HOY
    segs: list[list] = []
    d = inicio
    while d <= ultimo:
        if reciente and (d - a.compra).days < 30 and a.clave != SIN_CUARENTENA:
            u = "CUAR"          # toda compra nueva pasa 30 días aislada (la «Caridad» sigue en cuarentena hoy)
        else:
            u = ubic(a, d)
        if not segs or segs[-1][0] != u:
            segs.append([u, d, None])
        d += DIAS(days=1)
    out = []
    for i, (u, desde, _) in enumerate(segs):
        hasta = segs[i + 1][1] if i + 1 < len(segs) else fin   # abierto si sigue en el hato
        if hasta is not None and hasta < desde: hasta = desde
        motivo = "ingreso" if i == 0 else ("rotacion" if u.startswith("POT") or (i > 0 and segs[i - 1][0].startswith("POT")) else
                                           "cuarentena" if u == "CUAR" else "maternidad" if u == "MATER" else "traslado")
        out.append((u, desde, hasta, motivo))
    return out


def ocupacion_hoy(emitir: list[A]) -> dict[str, int]:
    n: dict[str, int] = {}
    for a in emitir:
        if a.baja and a.baja["fecha"] <= HOY: continue
        for u, desde, hasta, m in segmentos(a):
            if hasta is None: n[u] = n.get(u, 0) + 1
    return n


# ── identificación ───────────────────────────────────────────────────────────────────────────────────────────
MARCAS = ["Chapeta amarilla en la oreja izquierda", "Chapeta verde en la oreja derecha", "Muesca en la oreja izquierda", "Collar rojo",
          "Chapeta blanca en la oreja derecha", "Collar azul", "Chapeta naranja en la oreja izquierda"]
RASGOS = ["Mancha oscura en el ojo izquierdo", "Cuernos curvos hacia atrás", "Sin cuernos", "Pelo largo en el lomo", "Barba larga", "Mancha blanca en la frente",
          "Oreja izquierda caída", "Lunar en el hocico", "Cola corta"]


def chip(a: A) -> str | None:
    if a.edad_dias(HOY) < 120 and a.origen != "comprado": return None
    n = int(a.clave[-4:]) + (0 if a.especie == "caprino" else 5000)
    return f"982000{n:09d}"


def marca(a: A) -> str | None:
    r = rnd("marca", a.clave)
    return r.choice(MARCAS) if r.random() < .55 else None


def rasgo(a: A) -> str | None:
    r = rnd("rasgo", a.clave)
    return r.choice(RASGOS) if r.random() < .3 else None


def vocacion(a: A) -> str:
    return VOCACION[a.raza] if a.es_h else "carne"


def creado(a: A) -> str:
    """Cuándo se registró en Apriscol: los anteriores a T0 el día de la adopción; el resto, el día que nacieron o llegaron."""
    if a.origen == "comprado" and a.compra and a.compra > T0: return a.compra.isoformat() + " 08:00:00-05"
    if a.nac > T0: return a.nac.isoformat() + " 09:00:00-05"
    return T0.isoformat() + " 08:00:00-05"
