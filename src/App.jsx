import { useEffect, useLayoutEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigationType, useParams } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary'
import { AuthContext, useAuthProvider } from './hooks/useAuth'
import { useBetaGate } from './hooks/useBetaGate'
import BetaGate from './pages/BetaGate'
import Auth from './pages/Auth'
import Hub from './pages/Hub'
import Training from './pages/Training'
import Nutrition from './pages/Nutrition'
import Longevity from './pages/Longevity'
import Social from './pages/Social'
import ActiveWorkout from './pages/ActiveWorkout'
import ExerciseDetail from './pages/ExerciseDetail'
import History from './pages/History'
import Stats from './pages/Stats'
import ExerciseManager from './pages/ExerciseManager'
import Profile from './pages/Profile'
import Rutinas from './pages/Rutinas'
import RoutineDetail from './pages/RoutineDetail'
import Coach from './pages/Coach'
import ClientDetail from './pages/ClientDetail'
import Chat from './pages/Chat'

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

// App root with auth provider
function AppWithAuth() {
  const auth = useAuthProvider()

  return (
    <AuthContext.Provider value={auth}>
      <BrowserRouter>
        <ScrollManager />
        <ErrorBoundary>
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
          <Route path="/chat/:otherId"     element={<R auth={auth} element={<Chat />} />} />

          <Route path="/workout/:id"    element={<R auth={auth} element={<ActiveWorkout />} />} />
          <Route path="/exercise/:name" element={<R auth={auth} element={<ExerciseDetail />} />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </ErrorBoundary>
      </BrowserRouter>
    </AuthContext.Provider>
  )
}

export default AppWithAuth
