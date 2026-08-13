import { Link } from 'react-router-dom'

// Landing pública — lo único que ve un visitante sin sesión en "/".
//
// Copy local a propósito: i18n.js lo está tocando otra sesión y esta página
// es es-CO de nacimiento; si algún día la landing se traduce, se migra entera.
//
// Todo sale de los tokens de index.css: un solo acento (actuar / la cifra
// ganada), jerarquía por elevación y peso, Archivo para todo. Sin librerías,
// sin imágenes externas, sin scripts — la CSP de vercel.json no admite nada.

const MAILTO = 'mailto:pedroescobarconvers@hotmail.com?subject=Quiero%20probar%20Raw'

// ── Piezas pequeñas ────────────────────────────────────────────────────────

function Kicker({ children }) {
  return (
    <p style={{
      color: 'var(--c-text-muted)', fontSize: '11.5px', fontWeight: 700,
      letterSpacing: '-0.01em', marginBottom: '6px',
    }}>
      {children}
    </p>
  )
}

function Feature({ kicker, title, children }) {
  return (
    <section className="material" style={{ padding: '22px 20px' }}>
      <Kicker>{kicker}</Kicker>
      <h3 style={{
        color: 'var(--c-text)', fontSize: '19px', fontWeight: 800,
        letterSpacing: '-0.02em', lineHeight: 1.15, marginBottom: '10px',
      }}>
        {title}
      </h3>
      <p style={{ color: 'var(--c-text-secondary)', fontSize: '14px', fontWeight: 500, lineHeight: 1.55 }}>
        {children}
      </p>
    </section>
  )
}

// El mock del hero: una serie recién registrada, dibujada con los mismos
// tokens de la app. No es una captura — es el sistema hablando de sí mismo.
function SetMock() {
  return (
    <div className="material material-raised" style={{ padding: '22px 20px', maxWidth: '380px', width: '100%' }} aria-hidden="true">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '14px' }}>
        <p style={{ color: 'var(--c-text)', fontSize: '15px', fontWeight: 800, letterSpacing: '-0.02em' }}>
          Press de banca
        </p>
        <p style={{ color: 'var(--c-text-muted)', fontSize: '11.5px', fontWeight: 700 }}>
          Serie 3 de 4
        </p>
      </div>
      <p className="tnum" style={{
        color: 'var(--c-text)', fontFamily: 'var(--font-sans)', fontWeight: 900,
        fontSize: 'clamp(44px, 12vw, 56px)', lineHeight: 0.85, letterSpacing: '-0.045em',
      }}>
        100&nbsp;kg&nbsp;×&nbsp;8
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '14px' }}>
        {/* La cifra recién ganada es lo único no-accionable que viste el acento. */}
        <p className="tnum" style={{ color: 'var(--c-action-text)', fontSize: '14px', fontWeight: 800, letterSpacing: '-0.01em' }}>
          ▲ +2,5 kg
        </p>
        <p style={{ color: 'var(--c-text-muted)', fontSize: '12px', fontWeight: 700 }}>
          vs. la última sesión · PR
        </p>
      </div>
    </div>
  )
}

// ── Página ─────────────────────────────────────────────────────────────────

export default function Landing() {
  const btnBase = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    minHeight: '52px', padding: '14px 24px',
    borderRadius: 'var(--r-lg)', fontSize: '15px', fontWeight: 800,
    letterSpacing: '-0.01em', textDecoration: 'none',
  }

  return (
    <div className="fade-in" style={{ background: 'var(--c-bg)', minHeight: '100dvh' }}>
      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '0 20px' }}>

        {/* ── Cabecera ── */}
        <header style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          paddingTop: '18px', paddingBottom: '10px',
        }}>
          <span className="font-display" style={{ fontSize: '24px', color: 'var(--c-text)' }}>RAW</span>
          <Link
            to="/login"
            className="pressable"
            style={{
              ...btnBase, minHeight: '44px', padding: '10px 18px', fontSize: '13px',
              color: 'var(--c-action-text)', background: 'transparent',
              border: '1px solid var(--c-action-border)',
            }}
          >
            Entrar
          </Link>
        </header>

        {/* ── Hero ── */}
        <main>
          <section style={{ paddingTop: '40px', paddingBottom: '48px' }}>
            <h1 className="font-display" style={{
              fontSize: 'clamp(40px, 9vw, 64px)', color: 'var(--c-text)', lineHeight: 1.02,
            }}>
              Registra.<br />Progresa.<br />Nada más.
            </h1>
            <p style={{
              color: 'var(--c-text-secondary)', fontSize: '16px', fontWeight: 500,
              lineHeight: 1.55, marginTop: '18px', maxWidth: '46ch',
            }}>
              Raw es un registro de fuerza serie a serie: apuntas lo que acabas de
              levantar, ves si le ganaste a la última sesión y sigues entrenando.
            </p>

            <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'flex-start' }}>
              <SetMock />
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '32px' }}>
              <a
                href={MAILTO}
                className="pressable"
                style={{
                  ...btnBase,
                  background: 'var(--c-action)', color: 'var(--c-on-action)',
                  boxShadow: 'var(--e-1)',
                }}
              >
                Pedir acceso a la beta
              </a>
              <Link
                to="/login"
                className="pressable"
                style={{
                  ...btnBase,
                  color: 'var(--c-action-text)', background: 'transparent',
                  border: '1px solid var(--c-action-border)',
                }}
              >
                Entrar
              </Link>
            </div>
            <p style={{ color: 'var(--c-text-muted)', fontSize: '12px', fontWeight: 500, marginTop: '12px' }}>
              Raw está en beta cerrada: se entra con un código, por ahora a mano y sin lista de espera eterna.
            </p>
          </section>

          {/* ── Producto ── */}
          <div style={{ display: 'grid', gap: '14px', paddingBottom: '48px' }}>
            <Feature kicker="En el gym" title="Registrar sin que la app estorbe">
              Offline de verdad: si el sótano no tiene señal, la serie se guarda igual
              y se sincroniza al volver. Cada campo trae en fantasma lo que hiciste la
              última vez, y un PR solo se marca cuando es un PR — comparación honesta,
              no confetti.
            </Feature>

            <Feature kicker="Planificación" title="El ciclo se proyecta solo en tu calendario">
              Defines tu rotación una vez y Raw pone lo que toca en los días que de
              verdad entrenas. Terminas el entreno que correspondía y el plan se marca
              hecho — el calendario se mantiene cierto sin que lo cuides.
            </Feature>

            <Feature kicker="Nutrición" title="Objetivos que se explican">
              Macros y calorías contra objetivos calculados que te dicen de dónde
              salen, más 16 micronutrientes. Y un día sin registrar cuenta como
              ausente, no como cero: los promedios no se mienten solos.
            </Feature>

            <Feature kicker="Claude" title="Habla con tus datos">
              Conecta Raw a Claude y pide las cosas en el chat: «ármame un ciclo de
              fuerza de 4 días» y el ciclo aparece en la app, listo en tu calendario.
              Todo lo que el chat cambia se puede deshacer desde Raw.
            </Feature>
          </div>

          {/* ── Coach ── */}
          <section className="material" style={{ padding: '22px 20px', marginBottom: '48px' }}>
            <Kicker>Panel coach</Kicker>
            <h2 style={{
              color: 'var(--c-text)', fontSize: '19px', fontWeight: 800,
              letterSpacing: '-0.02em', lineHeight: 1.15, marginBottom: '10px',
            }}>
              ¿Entrenas gente?
            </h2>
            <p style={{ color: 'var(--c-text-secondary)', fontSize: '14px', fontWeight: 500, lineHeight: 1.55 }}>
              Raw tiene un panel para coaches: asignas rutinas, ves las sesiones de tus
              clientes el mismo día que pasan — estancamientos y PRs incluidos — y
              hablas con cada uno por chat dentro de la app. Mismo lenguaje, visto
              desde el otro lado.
            </p>
          </section>
        </main>

        {/* ── Pie: instalar la PWA ── */}
        <footer style={{ borderTop: '1px solid var(--c-border-subtle)', padding: '28px 0 48px' }}>
          <p style={{ color: 'var(--c-text)', fontSize: '14px', fontWeight: 800, letterSpacing: '-0.01em', marginBottom: '10px' }}>
            Raw se instala desde el navegador
          </p>
          <p style={{ color: 'var(--c-text-secondary)', fontSize: '13px', fontWeight: 500, lineHeight: 1.6 }}>
            <span style={{ fontWeight: 700 }}>iPhone:</span> abre Raw en Safari, toca
            Compartir y luego «Agregar a pantalla de inicio».
            <br />
            <span style={{ fontWeight: 700 }}>Android:</span> abre Raw en Chrome y toca
            «Instalar app» cuando el navegador lo ofrezca.
          </p>
          <p style={{ color: 'var(--c-text-muted)', fontSize: '12px', fontWeight: 500, marginTop: '18px' }}>
            Raw · We Do Gym
          </p>
        </footer>
      </div>
    </div>
  )
}
