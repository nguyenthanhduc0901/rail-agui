import { navLinks } from '../data/railDataAdapter'
import { Sidebar } from '../components/Sidebar'

export function AppLayout({ children }) {
  return (
    <div className="h-full bg-slate-50 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100 [font-family:var(--font-sans)]">
      <div className="relative flex h-full">
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
