import BottomNav from './BottomNav'
import Sidebar from './Sidebar'

export default function Layout({ children, hideNav = false }) {
  return (
    <>
      {/* ── Mobile layout (< md) ─────────────────────────────────────── */}
      <div className="md:hidden min-h-dvh bg-background flex flex-col">
        <main className={`flex-1 flex flex-col ${hideNav ? '' : 'pb-20'}`}>
          {children}
        </main>
        {!hideNav && <BottomNav />}
      </div>

      {/* ── Desktop layout (≥ md) ────────────────────────────────────── */}
      <div className="hidden md:flex min-h-dvh bg-background">
        {!hideNav && <Sidebar />}
        <main
          className="flex-1 overflow-y-auto"
          style={{ minHeight: '100dvh' }}
        >
          {children}
        </main>
      </div>
    </>
  )
}
