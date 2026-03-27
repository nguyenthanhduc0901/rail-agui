import { useState } from 'react'
import { ChevronLeft, ChevronRight, LayoutDashboard } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const iconMap = {
  Dashboard: LayoutDashboard,
}

export function Sidebar({ links }) {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()

  return (
    <aside
      className={`sticky top-0 h-screen border-r border-slate-200 bg-white shadow-sm transition-all duration-300 dark:border-slate-800 dark:bg-slate-900/90 dark:shadow-black/20 ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      <div className="flex h-full flex-col px-3 py-5">
        <div className="mb-6 flex items-center justify-between">
          <div className={`overflow-hidden transition-all ${collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
            <p className="font-display text-xl font-bold tracking-[0.12em] text-slate-900 dark:text-slate-100">RAIL OPS</p>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Control Nexus</p>
          </div>
          <button
            onClick={() => setCollapsed((prev) => !prev)}
            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-slate-100"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        <nav className="space-y-2">
          {links.map((link) => {
            const Icon = iconMap[link.label]
            const isActive = pathname === link.to

            return (
              <Link
                key={link.to}
                href={link.to}
                className={
                  `group flex items-center gap-3 rounded-xl border px-3 py-2.5 transition ${
                    isActive
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300'
                      : 'border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-100'
                  }`
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className={`text-sm font-medium ${collapsed ? 'hidden' : 'block'}`}>{link.label}</span>
              </Link>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}
