import { useEffect, useLayoutEffect, useRef, useState, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate, useNavigationType, useParams } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary'
import { AuthContext, useAuthProvider } from './hooks/useAuth'
import { useBetaGate } from './hooks/useBetaGate'
import { useWorkouts } from './hooks/useWorkout'
import { useProfile } from './hooks/useProfile'

// Route-level code splitting: each screen is its own chunk so the initial load
// only ships the shell + whatever route the user landed on. Recharts and other
// heavy per-page deps ride along in their route's chunk instead of the entry.
const BetaGate       = lazy(() => import('./pages/BetaGate'))
const Landing        = lazy(() => import('./pages/Landing'))
const Auth           = lazy(() => import('./pages/Auth'))
const ResetPassword  = lazy(() => import('./pages/ResetPassword'))
const Training       = lazy(() => import('./pages/Training'))
const Day            = lazy(() => import('./pages/Day'))
const Nutrition      = lazy(() => import('./pages/Nutrition'))
const Social         = lazy(() => import('./pages/Social'))
const Longevidad     = lazy(() => import('./pages/Longevidad'))
const Onboarding     = lazy(() => import('./pages/Onboarding'))
const ActiveWorkout  = lazy(() => import('./pages/ActiveWorkout'))
const ExerciseDetail = lazy(() => import('./pages/ExerciseDetail'))
const Progreso       = lazy(() => import('./pages/Progreso'))
const Stats          = lazy(() => import('./pages/Stats'))
const ExerciseManager = lazy(() => import('./pages/ExerciseManager'))
const Profile        = lazy(() => import('./pages/Profile'))
const Rutinas        = lazy(() => import('./pages/Rutinas'))
const RoutineDetail  = lazy(() => import('./pages/RoutineDetail'))
const Coach          = lazy(() => import('./pages/Coach'))
const ClientDetail   = lazy(() => import('./pages/ClientDetail'))
const Chat           = lazy(() => import('./pages/Chat'))
const Admin          = lazy(() => import('./pages/Admin'))
const OAuthConsent   = lazy(() => import('./pages/OAuthConsent'))
const SharedRoutine  = lazy(() => import('./pages/SharedRoutine'))

// Native-feel scrolling: jump to top when navigating to a new screen, and
// restore the previous position when going back/forward (POP). Pairs with the
// SWR cache — cached pages render at full height immediately, so restoration
// lands on the right spot.
function ScrollManager() {
  const { key } = useLocation()
  const navType = useNavigationType()
  const positions = useRef(new Map())

  useEffect(() => {
    const save = () => positions.current.set(key, window.scrollY)
    window.addEventListener('scroll', save, { passive: true })
    return () => { save(); window.removeEventListener('scroll', save) }
  }, [key])

  useLayoutEffect(() => {
    if (navType === 'POP') {
      window.scrollTo(0, positions.current.get(key) ?? 0)
    } else {
      window.scrollTo(0, 0)
    }
  }, [key, navType])

  return null
}

// Loading splash reutilizable
function Splash() {
  return (
    <div className="min-h-dvh bg-background flex items-center justify-center">
      <span className="text-text-muted text-xs uppercase tracking-widest animate-pulse">RAW</span>
    </div>
  )
}

// Protected layout wrapper: exige sesión Y aprobación de beta.
function RequireAuth({ children, auth }) {
  const beta = useBetaGate()

  if (auth.loading) return <Splash />
  if (!auth.user) return <Navigate to="/login" replace />

  // Verificando aprobación de beta
  if (beta.loading) return <Splash />
  // Autenticado pero sin canjear el código → pantalla de acceso beta
  if (!beta.approved) return <BetaGate />

  return <OnboardingGate>{children}</OnboardingGate>
}

// La primera vez: tres preguntas antes de entrar.
//
// Va en su propio componente y no dentro de RequireAuth para no consultar el
// perfil de quien todavía no ha pasado la puerta de beta.
//
// El «no tiene nombre» es la señal de que nunca se ha configurado nada. Quien
// ya tenga cuenta no ve esto jamás. Y quien diga «ahora no» tampoco vuelve a
// verlo en este dispositivo: insistir en cada navegación no consigue un perfil
// completo, consigue un nombre escrito de mala gana.
const ONBOARDING_SKIP = 'raw.onboardingSkipped'
const seSalto = () => {
  try { return window.localStorage.getItem(ONBOARDING_SKIP) === '1' } catch { return false }
}

function OnboardingGate({ children }) {
  const { profile, loading } = useProfile()
  const [skipped, setSkipped] = useState(seSalto)

  // Sin perfil todavía cargado no se decide nada: enseñar el onboarding a
  // alguien que sí tiene nombre, aunque sea un instante, es peor que esperar.
  if (loading && !profile) return <Splash />

  if (!profile?.name && !skipped) {
    return (
      <Onboarding
        onDone={() => {
          try { window.localStorage.setItem(ONBOARDING_SKIP, '1') } catch { /* solo esta sesión */ }
          setSkipped(true)
        }}
      />
    )
  }

  return children
}

function R({ auth, element }) {
  return <RequireAuth auth={auth}>{element}</RequireAuth>
}

// La raíz es la única ruta con dos caras: sin sesión es la landing pública
// (antes era un rebote ciego a /login y un visitante no sabía qué es Raw);
// con sesión, exactamente lo mismo de siempre — RequireAuth incluido, para
// que la puerta de beta y el onboarding sigan mandando.
function RootGate({ auth }) {
  if (auth.loading) return <Splash />
  if (!auth.user) return <Landing />
  return <RequireAuth auth={auth}><HomeGate /></RequireAuth>
}

// Home ("Hoy") with a cold-launch gate: the first time the app resolves the
// workout list in this session, an in-progress workout pulls you straight
// into it — the gym case. Navigating home afterwards never re-triggers it.
let launchChecked = false
function HomeGate() {
  const navigate = useNavigate()
  const { workouts, loading } = useWorkouts()

  useEffect(() => {
    if (launchChecked || loading) return
    launchChecked = true
    const active = workouts.find(w => !w.ended_at)
    if (active) navigate(`/workout/${active.id}`)
  }, [loading, workouts, navigate])

  return <Training />
}

// Coach viewing a client's stats — same window, read-only, scoped to the client.
function ClientStats() {
  const { id } = useParams()
  return <Stats userId={id} readOnly />
}

// Coach viewing a client's nutrition log — read-only entries, editable plan.
function ClientNutrition() {
  const { id } = useParams()
  return <Nutrition userId={id} readOnly />
}

// App root with auth provider
function AppWithAuth() {
  const auth = useAuthProvider()

  return (
    <AuthContext.Provider value={auth}>
      <BrowserRouter>
        <ScrollManager />
        <ErrorBoundary>
        <Suspense fallback={<Splash />}>
        <Routes>
          {/* Public */}
          <Route
            path="/login"
            element={
              auth.loading ? (
                <div className="min-h-dvh bg-background flex items-center justify-center">
                  <span className="text-text-muted text-xs uppercase tracking-widest animate-pulse">RAW</span>
                </div>
              ) : auth.user ? (
                <Navigate to="/" replace />
              ) : (
                <Auth />
              )
            }
          />

          {/* Password recovery landing (email link) — solo requiere la sesión
              de recuperación, fuera del gate de beta. */}
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Autorización OAuth: conectar la cuenta a una app externa (Claude).
              Va FUERA de RequireAuth a propósito — RequireAuth renderiza
              <BetaGate /> en el sitio en vez de navegar, y eso perdería el
              authorization_id de la URL. La página gestiona sesión y beta
              por su cuenta conservando los parámetros. */}
          <Route path="/oauth/consent" element={<OAuthConsent />} />

          {/* Rutina compartida por enlace. Pública a propósito: quien la recibe
              suele no tener cuenta, y ver el plan no expone nada más que el
              plan (supabase/routine_shares.sql). Guardarla sí exige sesión. */}
          <Route path="/r/:token" element={<SharedRoutine />} />

          {/* Protected — home ("Inicio"): calendario + portada. El antiguo
              índice /menu se fusionó aquí (sus secciones son ahora chips en la
              portada), así que la ruta sobrevive solo como redirección. */}
          <Route path="/"           element={<RootGate auth={auth} />} />
          <Route path="/menu"       element={<Navigate to="/" replace />} />

          {/* Entreno */}
          <Route path="/training"   element={<Navigate to="/" replace />} />
          <Route path="/dia/:fecha" element={<R auth={auth} element={<Day />} />} />
          <Route path="/progreso"   element={<R auth={auth} element={<Progreso />} />} />
          <Route path="/history"    element={<Navigate to="/progreso" replace />} />
          <Route path="/stats"      element={<Navigate to="/progreso?tab=stats" replace />} />
          <Route path="/ejercicios" element={<R auth={auth} element={<ExerciseManager />} />} />
          <Route path="/rutinas"    element={<R auth={auth} element={<Rutinas />} />} />
          <Route path="/rutina/:id" element={<R auth={auth} element={<RoutineDetail />} />} />

          {/* Nutrición · Social */}
          <Route path="/nutrition"  element={<R auth={auth} element={<Nutrition />} />} />
          <Route path="/social"     element={<R auth={auth} element={<Social />} />} />
          <Route path="/longevidad" element={<R auth={auth} element={<Longevidad />} />} />

          <Route path="/profile"    element={<R auth={auth} element={<Profile />} />} />

          <Route path="/coach"             element={<R auth={auth} element={<Coach />} />} />
          <Route path="/coach/cliente/:id"       element={<R auth={auth} element={<ClientDetail />} />} />
          <Route path="/coach/cliente/:id/stats" element={<R auth={auth} element={<ClientStats />} />} />
          <Route path="/coach/cliente/:id/nutricion" element={<R auth={auth} element={<ClientNutrition />} />} />
          <Route path="/chat/:otherId"     element={<R auth={auth} element={<Chat />} />} />

          {/* Admin — protegido por sesión; el gate real (is_admin) vive en la
              página y en las RPC del servidor. Sin entrada en la navegación. */}
          <Route path="/admin"             element={<R auth={auth} element={<Admin />} />} />

          <Route path="/workout/:id"    element={<R auth={auth} element={<ActiveWorkout />} />} />
          <Route path="/exercise/:name" element={<R auth={auth} element={<ExerciseDetail />} />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
        </ErrorBoundary>
      </BrowserRouter>
    </AuthContext.Provider>
  )
}

export default AppWithAuth
