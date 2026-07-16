import { useSearchParams } from 'react-router-dom'
import Layout from '../components/Layout'
import Segmented from '../components/stats/Segmented'
import History from './History'
import Stats from './Stats'

// Progreso — one destination for "what have I done?": the session timeline
// (Historial) and the aggregates (Estadísticas) as two views of the same
// question. The active view lives in ?tab= so links and back/forward work.
export default function Progreso() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'stats' ? 'stats' : 'historial'

  const setTab = (id) => {
    setParams(id === 'stats' ? { tab: 'stats' } : {}, { replace: true })
  }

  return (
    <Layout>
      <div className="fade-in px-4 max-w-lg mx-auto w-full md:max-w-[480px]">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', paddingTop: '40px', paddingBottom: '20px' }}>
          <h1 style={{ fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: '30px', letterSpacing: '-0.03em', color: 'var(--c-text)', lineHeight: 1.02 }}>
            Progreso
          </h1>
          <Segmented
            ariaLabel="Vista de progreso"
            value={tab}
            onChange={setTab}
            options={[
              { id: 'historial', label: 'Historial' },
              { id: 'stats', label: 'Estadísticas' },
            ]}
          />
        </div>

        {tab === 'historial' ? <History embedded /> : <Stats embedded />}
      </div>
    </Layout>
  )
}
