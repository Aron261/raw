---
name: Raw
description: PWA mobile-first para registrar entrenamiento de fuerza. Una paleta —hueso y azul apagado— en dos modos reales. La jerarquía la lleva la elevación, no el color.
colors:
  bg: "#E7E7E4"
  surface: "#FDFDFC"
  surface-2: "#EFEFEC"
  surface-3: "#E2E2DE"
  text: "#16181B"
  text-secondary: "#3C4148"
  text-dim: "#565C64"
  text-muted: "#5C626A"
  text-ghost: "#9BA0A6"
  action: "#2C56A6"
  action-text: "#274C93"
  on-action: "#FFFFFF"
  action-dim: "rgba(44,86,166,0.09)"
  action-border: "rgba(44,86,166,0.26)"
  success: "oklch(46% 0.10 150)"
  border: "rgba(22,24,27,0.14)"
  border-subtle: "rgba(22,24,27,0.07)"
  scrim: "rgba(22,24,27,0.42)"
  bg-dark: "#121316"
  surface-dark: "#1C1E22"
  text-dark: "#EDEEF0"
  action-dark: "#7FA0EA"
typography:
  greeting:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 900
    lineHeight: 1.02
    letterSpacing: "-0.03em"
  metric:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "56px"
    fontWeight: 900
    lineHeight: 0.82
    letterSpacing: "-0.045em"
  title:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: "-0.015em"
  label:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "11.5px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  data:
    fontFamily: "Space Mono, ui-monospace, monospace"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1
elevation:
  e-1: "0 1px 1px rgba(22,24,27,.045), 0 2px 4px rgba(22,24,27,.035)"
  e-2: "0 1px 2px rgba(22,24,27,.05), 0 8px 22px rgba(22,24,27,.07)"
  e-3: "0 2px 6px rgba(22,24,27,.07), 0 18px 44px rgba(22,24,27,.13)"
rounded:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "20px"
  xl: "26px"
  2xl: "32px"
  pill: "999px"
components:
  material:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
    shadow: "{elevation.e-1}"
    padding: "18px"
  button-primary:
    backgroundColor: "{colors.action}"
    textColor: "{colors.on-action}"
    rounded: "{rounded.lg}"
    padding: "18px"
    shadow: "{elevation.e-1}"
  input-field:
    backgroundColor: "{colors.surface-2}"
    rounded: "{rounded.md}"
    padding: "12px 14px"
    shadow: "inset 0 1px 2px rgba(22,24,27,.05)"
  sheet:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.2xl} {rounded.2xl} 0 0"
    shadow: "{elevation.e-3}"
    padding: "22px"
---

# Sistema de diseño: Raw

## 1. Idea

**Norte creativo: "Cuerpo".**

Raw se toca antes que se lee. El sistema anterior separaba las superficies con
un filete de 1px y prohibía la sombra ("etched, never floated"); este hace lo
contrario y lo hace a propósito: **la jerarquía la lleva la elevación**. Una
tarjeta se apoya sobre el hueso, sube al pasar el puntero, cede al pulsarla y
vuelve. Un campo de texto no flota: se hunde. La hoja de descanso se despega
del todo y se puede empujar con el pulgar.

Eso libera al color de tener que llevar la jerarquía, y por eso el color puede
callarse. Hay **un solo azul apagado** y no tiene más trabajo que decir "aquí
se actúa". No hay tres voces de marca ni dos paletas: la anterior tenía Slate y
Riso en paralelo, que era el doble de superficie que verificar a cambio de una
elección que se toma una vez.

**Rasgos:**
- **Elevación antes que color.** Tres pasos (`--e-1..--e-3`) y ninguno más.
- **Un acento, un trabajo.** Azul = actuar. Si aparece en un dato que nadie va
  a tocar, deja de significar nada donde importa.
- **Una familia de texto.** Archivo lo lleva todo, de la microcopia 500 al
  número héroe 900. Anton se retiró.
- **Dos modos reales.** Claro es hueso; oscuro es grafito templado — no la
  inversión del claro.
- **El pulgar primero.** Acciones en la zona baja, objetivos ≥44px.

## 2. Color

Una paleta, dos modos, resueltos por el script de arranque de `index.html`
antes del primer pintado (`data-theme` en `<html>`).

**Claro — hueso.** Fondo `#E7E7E4`, superficie `#FDFDFC`. El fondo no es blanco
a propósito: la tarjeta necesita algo contra lo que ser blanca.

**Oscuro — grafito templado.** Fondo `#121316`, superficie `#1C1E22`. Las
superficies **suben** en vez de bajar, porque en oscuro la sombra casi no
trabaja y el escalón de fondo es lo que separa.

**Acento** `#2C56A6` (claro) / `#7FA0EA` (oscuro). Los roles `--c-action`,
`--c-data` y `--c-record` apuntan todos a él. Ningún componente escribe un hex:
si algún día el récord quiere voz propia, es cambiar `--c-record` y ya.

**Success** es lo único que no es el acento: un verde apagado para
*hecho / completo* (el anillo del descanso, un objetivo al 100%). No decora.

### Reglas con nombre

**Regla del acento caro.** El azul solo aparece donde se puede actuar, o en la
cifra que se acaba de ganar. Una fecha, una etiqueta o un borde decorativo en
azul devalúan el botón de abajo.

**Regla del suelo de legibilidad.** Ningún texto que haya que leer baja de
`--c-text-muted`. `--c-text-ghost` es decoración.

## 3. Tipografía

**Archivo** para todo (500 → 900) y **Space Mono** solo para **tiempo, código y
lo que se copia**: el cronómetro, el enlace de una rutina compartida, el token
de OAuth y el detalle de un error.

Esa restricción es la corrección de un problema real: había 142 etiquetas en
mono con mayúsculas forzadas y tracking abierto. Cuando toda etiqueta es un
instrumento, ninguna señala nada — y el tracking se comía el ancho.

### Escala
- **Saludo / título de página** — 900, 30–34px, `-0.03em`.
- **Métrica** — 900, 26–56px, `-0.045em`, tabular.
- **Título de tarjeta** — 800, 15px, `-0.02em`.
- **Cuerpo** — 500, 12–13px.
- **Etiqueta** — 700, 11.5px, caja de frase. **No versalitas.**

### Reglas con nombre

**Regla del número héroe.** La cifra que manda en una pantalla es la más
grande, la más pesada y la más oscura. Se encoge el resto, nunca el número.

**Regla de la caja de frase.** Las etiquetas se escriben como se leen. Si una
cadena necesita ir en mayúsculas, va en mayúsculas en el origen — nunca por
CSS, porque entonces el diccionario guarda `'racha'` y en inglés sale
`'streak'` en minúscula el día que alguien quita el `text-transform`.

## 4. Elevación

Tres pasos, cada uno con dos capas —un contacto corto y pegado, y una difusa y
ancha—, porque una sombra de una sola capa se lee a plástico.

- **`--e-1`** reposo: una tarjeta apoyada en el hueso.
- **`--e-2`** lo que reclama atención o lo que está bajo el dedo: el récord de
  la semana, el ejercicio con PR, el botón primario al levantarse.
- **`--e-3`** lo que se despega del todo: hojas, menús, el temporizador, los
  toasts.

### Reglas con nombre

**Regla de los tres pasos.** Si algo necesita un cuarto nivel, el problema es
la composición, no la sombra.

**Regla de la contrapartida.** Lo que se toca sube; lo que recibe texto se
hunde (`inset` en `.input-field`). Si todo flota, nada flota.

## 5. Componentes

- **`.material`** es la primitiva: superficie + borde sutil + `--e-1` + radio
  `xl`. `.material-raised` sube a `--e-2`; `.material-tappable` añade el
  levantarse con puntero y el ceder al pulsar. El componente `<Card>` la
  envuelve y añade `accent` (el bloque teñido de la tarjeta de hoy).
- **`<Button>`** — `sm`/`md`/`lg` (52px de alto en `lg`). El primario lleva
  `--e-1` y resorte de pulsación a 0.975; los demás son planos.
- **`<Sheet>`** — arrastre vertical con `dragControls` desde el asa, cierre por
  velocidad o por recorrido, `SPRING_SETTLE` al abandonar. `--e-3` y radio
  `2xl` arriba.
- **Gráficas (recharts)** — los colores viven en `src/lib/chartColors.js`
  (`useChartColors()`), en hex literal por modo, porque `var()` no resuelve
  dentro de un atributo SVG. Un solo tono por serie: la barra que manda va a
  plena intensidad y el resto baja la opacidad.

## 6. Movimiento

El vocabulario vive en `src/lib/motion.js` y ningún componente declara un
resorte suelto. Todo lo animado tiene salida por `prefers-reduced-motion`.

## 7. Qué no hacer

- **No** meter un segundo color de marca. Si algo necesita distinguirse, se
  distingue por elevación, peso o tamaño.
- **No** poner versalitas por CSS.
- **No** usar Space Mono para prosa ni para etiquetas.
- **No** añadir un cuarto nivel de sombra ni una sombra literal en un `style`:
  se usa `--e-1..3`.
- **No** truncar el nombre de un ejercicio. Es la etiqueta que hay que
  reconocer entre serie y serie; envuelve a dos líneas.
- **No** invertir un modo para fabricar el otro.
