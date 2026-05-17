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

// App root with auth provider
function AppWithAuth() {
  const auth = useAuthProvider()

  return (
    <AuthContext.Provider value={auth}>
      <BrowserRouter>
        <Routes>
          {/* Public route */}
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

          {/* Protected routes */}
          <Route path="/" element={<RequireAuth auth={auth}><Home /></RequireAuth>} />

          <Route path="/dashboard" element={<RequireAuth auth={auth}><Dashboard /></RequireAuth>} />

          <Route path="/routines" element={<RequireAuth auth={auth}><Routines /></RequireAuth>} />

          <Route path="/workout/:id" element={<RequireAuth auth={auth}><ActiveWorkout /></RequireAuth>} />

          <Route path="/exercise/:name" element={<RequireAuth auth={auth}><ExerciseDetail /></RequireAuth>} />

          <Route path="/history" element={<RequireAuth auth={auth}><History /></RequireAuth>} />

          <Route path="/progress" element={<RequireAuth auth={auth}><Progress /></RequireAuth>} />

          <Route path="/profile" element={<RequireAuth auth={auth}><Profile /></RequireAuth>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  )
}

export default AppWithAuth
