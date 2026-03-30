import { CopilotChat } from "@copilotkit/react-core/v2";
import { Pencil } from 'lucide-react';
import { ReactNode } from 'react';
import { type Assignee } from '../data/railDataSource';
import { getPriorityStyle } from './CarriageDetailsModal';


function AssigneeAvatar({ assignee }: { assignee?: Assignee }): ReactNode {
    if (assignee) {
        return (
            <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${assignee.color} shadow-sm border-2 border-white cursor-help`}
                title={`Assigned to ${assignee.name}`}
            >
                {assignee.initials}
            </div>
        );
    }
    return (
        <div
            className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-700 border-dashed cursor-help"
            title="Unassigned"
        >
            ?
        </div>
    );
}


export function InlineAiChat() {
    return (
        <div className="shrink-0 border-t border-violet-100 bg-gradient-to-b from-white to-violet-50/30 flex flex-col h-[280px]">
            {/* Embedded CopilotChat */}
            <div className="flex-1 overflow-hidden">
                <CopilotChat
                    agentId="sample_agent"
                    className="h-full flex flex-col"
                />
            </div>
        </div>
    );
}

export function IssueCard({ issue, isSelected, onSelect, editedDescription }: { issue: any; isSelected: boolean; onSelect: (issue: any) => void; editedDescription?: string }) {
    const description = editedDescription || issue.description;

    return (
        <button
            onClick={() => onSelect(issue)}
            className={`w-full text-left p-4 rounded-xl border transition-all duration-200 group ${isSelected
                ? 'bg-blue-50 border-blue-300 shadow-md ring-2 ring-blue-200'
                : 'bg-white border-slate-200 hover:border-blue-200 hover:shadow-sm'
                }`}
        >
            {/* Top row */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {issue.id}
                    </span>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${getPriorityStyle(issue.priority)}`}>
                        {issue.priority}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <AssigneeAvatar assignee={issue.assignee} />
                    {isSelected && (
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                            Editing
                        </span>
                    )}
                </div>
            </div>

            {/* Description preview */}
            <p className="text-sm text-slate-700 leading-snug line-clamp-2 mb-3">
                {description}
            </p>

            {/* Bottom row */}
            <div className="flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="font-medium">{issue.system}</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full border font-medium capitalize ${issue.status === 'open'
                        ? 'bg-red-50 text-red-500 border-red-200'
                        : 'bg-blue-50 text-blue-500 border-blue-200'
                        }`}>
                        {issue.status.replace('-', ' ')}
                    </span>
                    {!isSelected && (
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-blue-500">
                            <Pencil className="w-3 h-3" />
                            Edit
                        </span>
                    )}
                </div>
            </div>
        </button>
    );
}