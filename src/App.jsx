import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthContext, useAuthProvider } from './hooks/useAuth'
import Auth from './pages/Auth'
import Home from './pages/Home'
import ActiveWorkout from './pages/ActiveWorkout'
import ExerciseDetail from './pages/ExerciseDetail'
import History from './pages/History'
import Profile from './pages/Profile'
import Rutinas from './pages/Rutinas'
import Coach from './pages/Coach'
import ClientDetail from './pages/ClientDetail'

// Protected layout wrapper that checks auth
function RequireAuth({ children, auth }) {
  if (auth.loading) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center">
        <span className="text-text-muted text-xs uppercase tracking-widest animate-pulse">RAW</span>
      </div>
    )
  }

  if (!auth.user) {
    return <Navigate to="/login" replace />
  }

  return children
}

function R({ auth, element }) {
  return <RequireAuth auth={auth}>{element}</RequireAuth>
}

// App root with auth provider
function AppWithAuth() {
  const auth = useAuthProvider()

  return (
    <AuthContext.Provider value={auth}>
      <BrowserRouter>
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

          {/* Protected */}
          <Route path="/"           element={<R auth={auth} element={<Home />} />} />
          <Route path="/history"    element={<R auth={auth} element={<History />} />} />
          <Route path="/rutinas"    element={<R auth={auth} element={<Rutinas />} />} />
          <Route path="/profile"    element={<R auth={auth} element={<Profile />} />} />

          <Route path="/coach"             element={<R auth={auth} element={<Coach />} />} />
          <Route path="/coach/cliente/:id" element={<R auth={auth} element={<ClientDetail />} />} />

          <Route path="/workout/:id"    element={<R auth={auth} element={<ActiveWorkout />} />} />
          <Route path="/exercise/:name" element={<R auth={auth} element={<ExerciseDetail />} />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  )
}

export default AppWithAuth
