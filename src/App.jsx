import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthContext, useAuthProvider } from './hooks/useAuth'
import Auth from './pages/Auth'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import ActiveWorkout from './pages/ActiveWorkout'
import ExerciseDetail from './pages/ExerciseDetail'
import History from './pages/History'
import Progress from './pages/Progress'
import Routines from './pages/Routines'
import Profile from './pages/Profile'
import Cycle from './pages/Cycle'
import Programa from './pages/Programa'

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
          <Route path="/programa"   element={<R auth={auth} element={<Programa />} />} />
          <Route path="/profile"    element={<R auth={auth} element={<Profile />} />} />

          {/* Still accessible but no longer in main nav */}
          <Route path="/cycle"      element={<R auth={auth} element={<Cycle />} />} />
          <Route path="/routines"   element={<R auth={auth} element={<Routines />} />} />
          <Route path="/progress"   element={<R auth={auth} element={<Progress />} />} />
          <Route path="/dashboard"  element={<R auth={auth} element={<Dashboard />} />} />

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
