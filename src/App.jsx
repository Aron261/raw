import { useEffect, useLayoutEffect, useRef, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigationType, useParams } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary'
import { AuthContext, useAuthProvider } from './hooks/useAuth'
import { useBetaGate } from './hooks/useBetaGate'

// Route-level code splitting: each screen is its own chunk so the initial load
// only ships the shell + whatever route the user landed on. Recharts and other
// heavy per-page deps ride along in their route's chunk instead of the entry.
const BetaGate       = lazy(() => import('./pages/BetaGate'))
const Auth           = lazy(() => import('./pages/Auth'))
const ResetPassword  = lazy(() => import('./pages/ResetPassword'))
const Hub            = lazy(() => import('./pages/Hub'))
const Training       = lazy(() => import('./pages/Training'))
const Nutrition      = lazy(() => import('./pages/Nutrition'))
const Longevity      = lazy(() => import('./pages/Longevity'))
const Social         = lazy(() => import('./pages/Social'))
const ActiveWorkout  = lazy(() => import('./pages/ActiveWorkout'))
const ExerciseDetail = lazy(() => import('./pages/ExerciseDetail'))
const History        = lazy(() => import('./pages/History'))
const Stats          = lazy(() => import('./pages/Stats'))
const ExerciseManager = lazy(() => import('./pages/ExerciseManager'))
const Profile        = lazy(() => import('./pages/Profile'))
const Rutinas        = lazy(() => import('./pages/Rutinas'))
const RoutineDetail  = lazy(() => import('./pages/RoutineDetail'))
const Coach          = lazy(() => import('./pages/Coach'))
const ClientDetail   = lazy(() => import('./pages/ClientDetail'))
const Chat           = lazy(() => import('./pages/Chat'))
const Admin          = lazy(() => import('./pages/Admin'))

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

  return children
}

function R({ auth, element }) {
  return <RequireAuth auth={auth}>{element}</RequireAuth>
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

          {/* Protected — hub */}
          <Route path="/"           element={<R auth={auth} element={<Hub />} />} />

          {/* Entreno */}
          <Route path="/training"   element={<R auth={auth} element={<Training />} />} />
          <Route path="/history"    element={<R auth={auth} element={<History />} />} />
          <Route path="/stats"      element={<R auth={auth} element={<Stats />} />} />
          <Route path="/ejercicios" element={<R auth={auth} element={<ExerciseManager />} />} />
          <Route path="/rutinas"    element={<R auth={auth} element={<Rutinas />} />} />
          <Route path="/rutina/:id" element={<R auth={auth} element={<RoutineDetail />} />} />

          {/* Nutrición · Longevidad · Social */}
          <Route path="/nutrition"  element={<R auth={auth} element={<Nutrition />} />} />
          <Route path="/longevity"  element={<R auth={auth} element={<Longevity />} />} />
          <Route path="/social"     element={<R auth={auth} element={<Social />} />} />

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
