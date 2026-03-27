import { Inbox } from 'lucide-react'

export function EmptyState({ title, description }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center shadow-sm">
      <Inbox className="mx-auto h-8 w-8 text-slate-400" />
      <h3 className="mt-3 text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
    </div>
  )
}
