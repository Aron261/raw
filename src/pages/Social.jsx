import Layout from '../components/Layout'
import { PageHeader } from '../components/ui'

// Lo que viene — declarado sin UI falsa: filas honestas, no mockups muertos.
const UPCOMING = [
  {
    title: 'Amigos',
    sub: 'Sigue a la gente con la que entrenas.',
  },
  {
    title: 'Feed de entrenos',
    sub: 'Lo que levantó tu gente, sin filtros ni poses.',
  },
  {
    title: 'PRs compartidos',
    sub: 'Un récord de un amigo se celebra una vez — y con el número.',
  },
]

export default function Social() {
  return (
    <Layout>
      <div className="w-full px-5 pb-10 max-w-[480px] mx-auto md:max-w-[640px] md:px-8">

        <PageHeader
          title="Social"
          right={
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.1em',
              background: 'var(--c-accent-dim)', color: 'var(--c-action-text)',
              border: '1px solid var(--c-accent-border)',
              padding: '5px 10px', borderRadius: '999px',
            }}>
              Próximamente
            </span>
          }
        />

        <div className="fade-in" style={{ animationDelay: '40ms' }}>
          <p style={{
            fontFamily: 'var(--font-sans)', color: 'var(--c-text)',
            fontSize: '22px', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.15,
            maxWidth: '20ch', marginBottom: '10px',
          }}>
            Entrena con tu gente.
          </p>
          <p style={{ color: 'var(--c-text-muted)', fontSize: '13px', lineHeight: 1.55, maxWidth: '44ch', marginBottom: '28px' }}>
            Estamos construyendo la parte social de Raw: números reales entre gente real. Sin streaks, sin badges, sin ruido.
          </p>

          {UPCOMING.map((item, i) => (
            <div
              key={item.title}
              className="stagger-item"
              style={{
                padding: '18px 0',
                borderTop: '1px solid var(--c-border-subtle)',
                animationDelay: `${80 + i * 45}ms`,
              }}
            >
              <p style={{ color: 'var(--c-text)', fontSize: '15px', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '4px' }}>
                {item.title}
              </p>
              <p style={{ color: 'var(--c-text-muted)', fontSize: '12px', lineHeight: 1.5 }}>
                {item.sub}
              </p>
            </div>
          ))}
        </div>

      </div>
    </Layout>
  )
}
