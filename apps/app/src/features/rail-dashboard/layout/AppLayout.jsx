import { navLinks } from '../data/railDataSource'
import { Sidebar } from '../components/Sidebar'

export function AppLayout({ children }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 [font-family:var(--font-sans)]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(148,163,184,0.14),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.1),transparent_28%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(30,41,59,0.35),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(2,132,199,0.2),transparent_32%)]" />
      <div className="relative flex min-h-screen">
        <Sidebar links={navLinks} />

        <div className="flex min-w-0 flex-1 flex-col">
          <main className="flex-1 px-4 py-5 lg:px-6 lg:py-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
