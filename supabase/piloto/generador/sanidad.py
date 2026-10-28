"""Sanidad del piloto: campañas, esquema de crías, tratamientos, FAMACHA con su desparasitación, pruebas de laboratorio y programas. Datos FICTICIOS.

Regla que atraviesa todo: ningún animal que se vende o sacrifica para consumo recibe un producto cuyo retiro de carne llegue hasta su salida.
"""
from __future__ import annotations

import datetime as dt

import sim
from sim import A, HOY, T0, VOCACION
from hato import rnd, lactancias, DIAS

VET = "Andrés Zapata"
D = dt.date

# producto -> (retiro_leche, retiro_carne, via, unidad, dosis típica)
PROD = {
    "Ivermectina 1 %": (14, 35, "subcutanea", "ml", 1.0),
    "Albendazol 10 %": (5, 14, "oral", "ml", 5.0),
    "Vacuna clostridial 7 vías": (0, 21, "subcutanea", "ml", 2.0),
    "Vacuna antirrábica": (0, 0, "intramuscular", "ml", 2.0),
    "Oxitetraciclina de larga acción": (7, 28, "intramuscular", "ml", 3.0),
    "Penicilina con estreptomicina": (4, 30, "intramuscular", "ml", 4.0),
    "Antibiótico intramamario": (4, 14, "intramamaria", "jeringa", 1.0),
    "Meloxicam": (5, 14, "subcutanea", "ml", 1.5),
    "Complejo B y reconstituyente": (0, 0, "intramuscular", "ml", 5.0),
}
LOTES = {"Vacuna clostridial 7 vías": ("CL7-2511", D(2027, 4, 30), "CL7-2605", D(2027, 11, 30)), "Vacuna antirrábica": ("RB-2602", D(2027, 8, 31)),
         "Ivermectina 1 %": ("IV-2509", D(2027, 9, 30)), "Albendazol 10 %": ("AL-2510", D(2028, 1, 31))}


def d(x): return x.isoformat() if x else None


def consumo(a: A):
    b = a.baja
    return b["fecha"] if b and (b["tipo"] == "sacrificio" or (b["tipo"] == "venta" and b.get("destino_consumo"))) else None


def viva(a: A, f: D) -> bool:
    if a.nac > f: return False
    if a.baja is not None and a.baja["fecha"] <= f: return False
    if a.origen == "comprado" and a.compra and a.compra > f: return False
    return True


def retiro_ok(a: A, f: D, rc: int) -> bool:
    s = consumo(a)
    return s is None or not (f <= s <= f + DIAS(days=rc))


def ev(fecha, tipo, producto=None, categoria=None, etapa=None, motivo=None, via=None, dosis=None, unidad=None, lote=None, venc=None, rl=None, rc=None, prox=None,
       diag=None, obs=None, conc=None, minutos=None, anest=None, cojera=None, dias=None, animales=()):
    if producto in PROD:
        p = PROD[producto]
        rl = p[0] if rl is None else rl
        rc = p[1] if rc is None else rc
        via = via or p[2]
        unidad = unidad or p[3]
        dosis = dosis or p[4]
    return [d(fecha), tipo, categoria, etapa, motivo, producto, dosis, unidad, via, lote, d(venc), rl, rc, d(prox), diag, obs, conc, minutos, anest, cojera, dias, [a.clave if isinstance(a, A) else a for a in animales]]


def lote_de(producto, fecha):
    l = LOTES.get(producto)
    if not l: return None, None
    if len(l) == 4 and fecha >= D(2026, 4, 1): return l[2], l[3]
    return l[0], l[1]


def construir(res) -> dict:
    em: list[A] = res["emitir"]
    vivos_t0 = [a for a in em]
    eventos: list = []
    famacha: list = []
    pruebas: list = []

    def grupo(f: D, edad_min: int, rc: int, filtro=None):
        return [a for a in em if viva(a, f) and a.edad_dias(f) >= edad_min and retiro_ok(a, f, rc) and (filtro is None or filtro(a))]

    # ── vacuna clostridial anual (adultos) ─────────────────────────────────────────────────────────────────
    for f in (D(2025, 11, 20), D(2026, 5, 14)):
        lote, venc = lote_de("Vacuna clostridial 7 vías", f)
        eventos.append(ev(f, "vacunacion", "Vacuna clostridial 7 vías", "clostridiales", "anual", None, lote=lote, venc=venc, prox=f + DIAS(days=365),
                          obs="Campaña de todo el hato", animales=grupo(f, 330, 21)))
    # ── esquema de crías: primera dosis a los 2-3 meses y refuerzo a las 4 semanas ─────────────────────────────
    y, m = 2025, 12
    while D(y, m, 10) <= HOY - DIAS(days=1):
        f1 = D(y, m, 10)
        ninos = grupo(f1, 60, 21, lambda a: a.edad_dias(f1) <= 100)
        if ninos:
            lote, venc = lote_de("Vacuna clostridial 7 vías", f1)
            eventos.append(ev(f1, "vacunacion", "Vacuna clostridial 7 vías", "clostridiales", "primera", None, lote=lote, venc=venc, prox=f1 + DIAS(days=28), obs="Crías de 2 a 3 meses", animales=ninos))
            f2 = f1 + DIAS(days=28)
            if f2 <= HOY:
                ref = [a for a in ninos if viva(a, f2) and retiro_ok(a, f2, 21)]
                if ref:
                    lote, venc = lote_de("Vacuna clostridial 7 vías", f2)
                    eventos.append(ev(f2, "vacunacion", "Vacuna clostridial 7 vías", "clostridiales", "refuerzo", None, lote=lote, venc=venc, prox=f2 + DIAS(days=365), animales=ref))
        m += 1
        if m == 13: y, m = y + 1, 1
    # ── rabia ──────────────────────────────────────────────────────────────────────────────────────────────
    f = D(2026, 3, 3)
    lote, venc = lote_de("Vacuna antirrábica", f)
    eventos.append(ev(f, "vacunacion", "Vacuna antirrábica", "rabia", "anual", None, lote=lote, venc=venc, prox=D(2027, 3, 3), obs="Campaña anual contra la rabia paralítica", animales=grupo(f, 90, 0)))

    # ── pediluvio (cada 30 días; cada 15 en los meses de lluvia: abril, mayo, octubre y noviembre) ───────────
    f = D(2025, 11, 4)
    while f <= HOY:
        eventos.append(ev(f, "pediluvio", "Sulfato de zinc 10 %", "zinc", None, None, via="topica", dosis=None, unidad=None, rl=0, rc=0, conc=10, minutos=15,
                          obs="Baño de pezuñas a todo el hato", animales=grupo(f, 120, 0)))
        f += DIAS(days=15 if f.month in (4, 5, 9, 10, 11) else 30)      # en septiembre ya se adelanta al ritmo de las lluvias
    # ── podología: recorte general y curaciones; 8 adultos quedan con la revisión vencida a propósito ───────────
    adultos_hoy = [a for a in em if viva(a, HOY) and a.edad_dias(HOY) >= 330]
    rr = rnd("podologia-vencida")
    vencidos = set(a.clave for a in rr.sample(adultos_hoy, 8))
    eventos.append(ev(D(2026, 2, 5), "podologia", None, "recorte", rl=0, rc=0, cojera=0, minutos=3, obs="Recorte de pezuñas de todo el hato", animales=grupo(D(2026, 2, 5), 330, 0)))
    eventos.append(ev(D(2026, 6, 10), "podologia", None, "recorte", rl=0, rc=0, cojera=0, minutos=3, obs="Recorte de pezuñas; faltaron algunos animales por cojera de otros",
                      animales=grupo(D(2026, 6, 10), 330, 0, lambda a: a.clave not in vencidos)))
    cura = [a for a in adultos_hoy if a.especie == "ovino"] + [a for a in adultos_hoy if a.especie == "caprino"]
    rc_ = rnd("podologia-curacion")
    for i, a in enumerate(rc_.sample(cura, 6)):
        f = D(2026, 3, 1) + DIAS(days=rc_.randint(0, 220))
        if viva(a, f) and a.edad_dias(f) > 330:
            eventos.append(ev(f, "podologia", None, "curacion", rl=0, rc=0, cojera=rc_.choice([1, 2, 2, 3]), minutos=10, anest="ninguna",
                              diag=rc_.choice(["Pododermatitis", "Absceso en la pezuña", "Podredumbre interdigital"]), prox=f + DIAS(days=14), animales=[a]))

    # ── tratamientos individuales ──────────────────────────────────────────────────────────────────────────
    rt = rnd("tratamientos")

    def fecha_en(a: A, ini: D, fin: D):
        ini = max(ini, a.nac, a.compra if a.origen == "comprado" and a.compra else ini, T0)
        fin = min(fin, a.baja["fecha"] - DIAS(days=1) if a.baja else HOY)
        if fin <= ini: return None
        return ini + DIAS(days=rt.randint(0, (fin - ini).days))

    # mastitis en cabras en leche
    leche = [a for a in em if a.especie == "caprino" and a.es_h and lactancias(a)]
    hecho = 0
    for a in rt.sample(leche, len(leche)):
        if hecho >= 6: break
        ls = [l for l in lactancias(a) if l["parto"] + DIAS(days=25) < HOY]
        if not ls: continue
        l = ls[-1]
        f = fecha_en(a, l["parto"] + DIAS(days=25), min(l["secado_plan"], HOY))
        if f is None or not retiro_ok(a, f, 14): continue
        lado = rt.choice(["izquierda", "derecha"])
        eventos.append(ev(f, "tratamiento", "Antibiótico intramamario", "mastitis", None, None, dias=3, rl=4, rc=14, prox=f + DIAS(days=10),
                          diag=f"Mastitis clínica en la ubre {lado}", obs="Se descartó la leche del lado afectado", animales=[a]))
        pruebas.append([a.clave, "mastitis_cultivo", d(f - DIAS(days=1)), "positivo", "Laboratorio Veterinario del Norte", "Staphylococcus sp."])
        hecho += 1
    # crías: diarrea (digestivo) y coccidiosis (desparasitación)
    crias = [a for a in em if not a.baja or a.baja["fecha"] > T0]
    crias = [a for a in crias if a.nac >= T0 - DIAS(days=60)]
    rt.shuffle(crias)
    n = 0
    for a in crias:
        if n >= 4: break
        f = fecha_en(a, a.nac + DIAS(days=20), a.nac + DIAS(days=80))
        if f is None or not retiro_ok(a, f, 30): continue
        eventos.append(ev(f, "tratamiento", "Penicilina con estreptomicina", "digestivo", None, None, dias=3, rl=0, rc=30, prox=f + DIAS(days=7),
                          diag="Diarrea en cría", obs="Rehidratación oral y reposo", animales=[a]))
        n += 1
    for k, f in enumerate((D(2026, 2, 12), D(2026, 8, 20))):
        lote = [a for a in crias if a.especie == "caprino" and viva(a, f) and 28 <= a.edad_dias(f) <= 90 and retiro_ok(a, f, 21)][:6]
        if lote:
            eventos.append(ev(f, "desparasitacion", "Toltrazurilo 5 %", "coccidiosis", None, "otro", via="oral", dosis=1.0, unidad="ml", rl=0, rc=21, prox=f + DIAS(days=14),
                              obs="Brote de diarrea en el corral de crías; se trataron todas las del corral", animales=lote))
    # respiratorio, herida, metabólico y reproductivo
    adultos = [a for a in em if a.edad_dias(HOY) > 365 and a.nac < T0]
    rt.shuffle(adultos)
    plan = [("respiratorio", "Oxitetraciclina de larga acción", "Neumonía", 5), ("herida", "Penicilina con estreptomicina", "Absceso en el cuello", 3),
            ("metabolico", "Complejo B y reconstituyente", "Hipocalcemia posparto", 2), ("reproductivo", "Oxitetraciclina de larga acción", "Retención de placenta", 2)]
    for categoria, prod, diag, cuantos in plan:
        hecho = 0
        for a in adultos:
            if hecho >= cuantos: break
            if categoria in ("metabolico", "reproductivo"):
                partos = [p[0] for p in a.partos if T0 <= p[0] <= HOY]
                if not partos: continue
                f = partos[0] + DIAS(days=rt.randint(1, 4))
            else:
                f = fecha_en(a, T0, HOY - DIAS(days=3))
            if f is None or f > HOY or not viva(a, f) or not retiro_ok(a, f, PROD[prod][1]): continue
            eventos.append(ev(f, "tratamiento", prod, categoria, None, None, dias=3 if categoria != "metabolico" else 1, prox=f + DIAS(days=7), diag=diag, animales=[a]))
            hecho += 1
            adultos.remove(a)
    # cesáreas (cirugía), alineadas con los partos que salieron como cesárea
    import repro
    for fila in repro.construir(res)["filas"]:
        if fila[14] == "cesarea":
            a = next(x for x in em if x.clave == fila[0])
            f = D.fromisoformat(fila[13])
            eventos.append(ev(f, "cirugia", "Penicilina con estreptomicina", "cesarea", None, None, dias=3, anest="sedacion", minutos=45, diag="Cesárea por parto distócico",
                              obs="Se registró también en el parto", animales=[a]))
    # ── FAMACHA y desparasitación ──────────────────────────────────────────────────────────────────────────
    rondas = [D(2025, 11, 18), D(2026, 1, 13), D(2026, 3, 10), D(2026, 5, 5), D(2026, 6, 30), D(2026, 8, 25), D(2026, 10, 6), D(2026, 10, 21)]
    carga: dict[str, float] = {}
    tratados: dict[D, list] = {}
    ultimo_puntaje: dict[str, tuple] = {}
    for rd_ in rondas:
        rr = rnd("famacha", rd_)
        lluvia = rd_.month in (3, 4, 5, 10, 11)
        for a in sorted(em, key=lambda x: x.clave):
            if not viva(a, rd_) or a.edad_dias(rd_) < 90: continue
            r = rnd("fam", a.clave, rd_)
            if r.random() > 0.88 and rd_ != rondas[-1]: continue
            sus = rnd("susc", a.clave).uniform(0.7, 1.6)       # cada animal es más o menos susceptible a los parásitos
            L = carga.get(a.clave, r.uniform(0.3, 1.2))
            L = 0.6 * L + sus * (0.65 if lluvia else 0.4) + r.gauss(0, 0.6)
            L = max(0.0, L)
            punt = max(1, min(5, 1 + int(L + 0.5)))
            s = consumo(a)
            if s and (s - rd_).days <= 45: punt = min(punt, 3)
            carga[a.clave] = L
            ultimo_puntaje[a.clave] = (rd_, punt)
            famacha.append([a.clave, d(rd_), punt, "Mucosa pálida; revisar condición corporal" if punt >= 4 else None])
    # la última ronda (21-oct) se arma a mano para que el hato muestre qué hacer hoy
    ultima = rondas[-1]
    f_ult = [x for x in famacha if x[1] == d(ultima)]
    activos = sorted([a for a in em if viva(a, ultima) and a.edad_dias(ultima) >= 330 and consumo(a) is None and a.baja is None], key=lambda a: a.clave)
    rs = rnd("famacha-final")
    elegidos = rs.sample(activos, 10)
    por_clave = {x[0]: x for x in f_ult}
    plan_final = {elegidos[0].clave: 5, elegidos[1].clave: 4, elegidos[2].clave: 4, elegidos[3].clave: 4, elegidos[4].clave: 3, elegidos[5].clave: 3,
                  elegidos[6].clave: 3, elegidos[7].clave: 3, elegidos[8].clave: 4, elegidos[9].clave: 4}
    sin_tratar = {elegidos[0].clave, elegidos[1].clave, elegidos[2].clave, elegidos[3].clave}
    ya_tratados = {elegidos[8].clave, elegidos[9].clave}
    for x in f_ult:
        if x[0] in plan_final: continue
        if x[2] >= 3: x[2] = 2 if rs.random() < .7 else x[2]
        if x[2] >= 4: x[2] = 2
        x[3] = None
    for c, p in plan_final.items():
        if c in por_clave:
            por_clave[c][2] = p
            por_clave[c][3] = "Mucosa pálida; desparasitar y revisar condición corporal" if p >= 4 else "Mucosa algo pálida; volver a revisar en dos semanas"
        else:
            famacha.append([c, d(ultima), p, "Mucosa pálida" if p >= 4 else None])
    # desparasitaciones: por ronda, los de 4 o 5 (salvo los dejados sin tratar a propósito)
    por_ronda: dict[str, list] = {}
    for x in famacha:
        if x[2] >= 4 and x[0] not in sin_tratar:
            por_ronda.setdefault(x[1], []).append(x[0])
    claves = {a.clave: a for a in em}
    for fecha, lista in sorted(por_ronda.items()):
        f = D.fromisoformat(fecha)
        f_t = f + DIAS(days=1)
        ivo, alb = [], []
        for c in lista:
            a = claves[c]
            if not viva(a, f_t): continue
            lact = a.especie == "caprino" and a.es_h and any(l["parto"] <= f_t <= l["secado_plan"] for l in lactancias(a))
            if lact or not retiro_ok(a, f_t, 35):
                if retiro_ok(a, f_t, 14): alb.append(a)
            else:
                ivo.append(a)
        for prod, lst in (("Ivermectina 1 %", ivo), ("Albendazol 10 %", alb)):
            if lst:
                lote, venc = lote_de(prod, f_t)
                eventos.append(ev(f_t, "desparasitacion", prod, "gastrointestinales", None, "famacha", lote=lote, venc=venc, prox=f_t + DIAS(days=21),
                                  obs="Animales con FAMACHA 4 o 5 en la revisión del " + f.strftime("%d/%m"), animales=lst))
    # ── pruebas de laboratorio ─────────────────────────────────────────────────────────────────────────────
    rp = rnd("pruebas")
    adul = [a for a in em if viva(a, D(2026, 2, 18)) and a.edad_dias(D(2026, 2, 18)) >= 400]
    for a in rp.sample(adul, 24):
        pruebas.append([a.clave, "cae", "2026-02-18", "negativo", "Laboratorio Veterinario del Norte", None])
    if adul:
        sospechoso = rp.choice([a for a in adul if a.especie == "caprino"])
        for x in pruebas:
            if x[0] == sospechoso.clave and x[1] == "cae":
                x[3] = "sospechoso"; x[5] = "Repetir en 30 días; mantener separada de las crías"
    for a in rp.sample(adul, 12):
        pruebas.append([a.clave, "brucelosis", "2026-03-05", "negativo", "Laboratorio Veterinario del Norte", None])
    for a in rp.sample([a for a in leche if a.baja is None], 14):
        pruebas.append([a.clave, "cmt", d(HOY - DIAS(days=rp.randint(3, 20))), rp.choice(["negativo", "negativo", "negativo", "sospechoso"]), None, "Prueba de California en el ordeño"])
    for a in rp.sample([a for a in adul if a.especie == "caprino"], 2):
        pruebas.append([a.clave, "paratuberculosis", "2026-04-22", "negativo", "Laboratorio Veterinario del Norte", None])
    eventos.sort(key=lambda e: (e[0], e[1]))
    famacha.sort(key=lambda x: (x[1], x[0]))
    pruebas.sort(key=lambda x: (x[2], x[0], x[1]))
    # ── programas (lo que viene) ───────────────────────────────────────────────────────────────────────────
    f = D(2026, 11, 18)
    programas = [
        ["vacunacion", d(f), "Vacuna clostridial 7 vías", "Refuerzo anual de todo el hato", [a.clave for a in em if viva(a, HOY) and a.edad_dias(HOY) >= 300]],
        ["pediluvio", d(HOY + DIAS(days=7)), "Sulfato de zinc 10 %", "Baño de pezuñas quincenal (temporada de lluvia)", [a.clave for a in em if viva(a, HOY) and a.edad_dias(HOY) >= 120]],
        ["desparasitacion", d(HOY + DIAS(days=2)), "Ivermectina 1 %", "Los animales con FAMACHA 4 o 5 sin tratar", sorted(sin_tratar)],
    ]
    return dict(eventos=eventos, famacha=famacha, pruebas=pruebas, programas=programas, sin_tratar=sorted(sin_tratar), ya_tratados=sorted(ya_tratados))


def verificar(res, o):
    """Falla si algún evento rompe una regla: animal inexistente ese día o salida para consumo dentro del retiro de carne."""
    claves = {a.clave: a for a in res["emitir"]}
    for e in o["eventos"]:
        f = D.fromisoformat(e[0])
        rc = e[12] or 0
        for c in e[-1]:
            a = claves[c]
            assert viva(a, f), ("animal no vivo", c, e[0], e[1])
            assert retiro_ok(a, f, rc), ("dentro del retiro de carne", c, e[0], e[5], rc, consumo(a))
    return True


if __name__ == "__main__":
    import hato
    r = sim.simular(hato.SEED)
    o = construir(r)
    from collections import Counter
    print({k: len(v) for k, v in o.items()})
    print(Counter(e[1] for e in o["eventos"]))
    print("aretes en eventos:", sum(len(e[-1]) for e in o["eventos"]))
    print(Counter(x[2] for x in o["famacha"]))
    print("verificación:", verificar(r, o))
    print("último FAMACHA:", Counter(x[2] for x in o["famacha"] if x[1] == "2026-10-21"))

