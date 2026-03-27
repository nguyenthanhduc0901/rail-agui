import React, { useState, useMemo, useEffect } from 'react';
import { getCarriageSystems, getActiveIssuesByCarriage } from '../data/mockData';

// --- HÀM HELPER ĐỂ ĐỊNH DẠNG MÀU SẮC ---
const getHealthStatus = (health) => {
  if (health >= 85) return { 
    color: 'text-emerald-600', 
    bg: 'bg-emerald-500', 
    // Giảm opacity từ 0.5 xuống 0.2 và giảm độ nhòe
    glow: 'shadow-[0_0_8px_rgba(16,185,129,0.2)]', 
    label: 'Healthy', 
    border: 'border-emerald-500/30', // Cho viền mờ đi một chút
    lightBg: 'bg-emerald-50' 
  };
  if (health >= 70) return { 
    color: 'text-amber-600', 
    bg: 'bg-amber-500', 
    glow: 'shadow-[0_0_8px_rgba(245,158,11,0.2)]', 
    label: 'Warning', 
    border: 'border-amber-500/30', 
    lightBg: 'bg-amber-50' 
  };
  return { 
    color: 'text-red-600', 
    bg: 'bg-red-500', 
    glow: 'shadow-[0_0_12px_rgba(239,68,68,0.3)]', // Critical thì sáng hơn một chút nhưng vẫn dịu
    label: 'Critical', 
    border: 'border-red-500/30', 
    lightBg: 'bg-red-50' 
  };
};

const getPriorityStyle = (priority) => {
  switch (priority) {
    case 'high': return 'bg-red-50 text-red-700 border-red-200';
    case 'medium': return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'low': return 'bg-blue-50 text-blue-700 border-blue-200';
    default: return 'bg-slate-50 text-slate-700 border-slate-200';
  }
};

export function CarriageDetailsModal({ isOpen, onClose, train, carriage }) {
  const [filterSystem, setFilterSystem] = useState('All');
  const [filterPriority, setFilterPriority] = useState('All');
  const [filterAssignee, setFilterAssignee] = useState('All');
  const [sortBy, setSortBy] = useState('date-desc');

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  const systems = useMemo(() => {
    if (!train || !carriage) return [];
    return getCarriageSystems(train.id, carriage.id);
  },[train, carriage]);

  const rawIssues = useMemo(() => {
    if (!train || !carriage) return[];
    return getActiveIssuesByCarriage(train.id, carriage.id);
  },[train, carriage]);

  const uniqueAssignees = useMemo(() => {
    const assignees = rawIssues.map(i => i.assignee?.name).filter(Boolean);
    return['All', 'Unassigned', ...new Set(assignees)];
  }, [rawIssues]);

  const filteredAndSortedIssues = useMemo(() => {
    let result = [...rawIssues];
    if (filterSystem !== 'All') result = result.filter(i => i.system === filterSystem);
    if (filterPriority !== 'All') result = result.filter(i => i.priority === filterPriority.toLowerCase());
    if (filterAssignee !== 'All') {
      if (filterAssignee === 'Unassigned') result = result.filter(i => !i.assignee);
      else result = result.filter(i => i.assignee?.name === filterAssignee);
    }
    result.sort((a, b) => {
      if (sortBy === 'date-desc') return new Date(b.date) - new Date(a.date);
      if (sortBy === 'date-asc') return new Date(a.date) - new Date(b.date);
      if (sortBy === 'priority') {
        const pLevel = { high: 3, medium: 2, low: 1 };
        return pLevel[b.priority] - pLevel[a.priority];
      }
      return 0;
    });
    return result;
  },[rawIssues, filterSystem, filterPriority, filterAssignee, sortBy]);

  if (!isOpen || !carriage) return null;

  // --- COMPONENT VẼ HỆ THỐNG CHÂN THỰC TRÊN TOA TÀU ---
  const renderSystemUI = (system, hasIssues, status) => {
    const isPinging = hasIssues;
    
    // Khung Tooltip chung dùng cho mọi hệ thống
    const Tooltip = () => (
      <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-52 bg-white rounded-xl shadow-2xl border border-slate-200 p-3 opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-50 transform group-hover:-translate-y-1">
        <div className="flex justify-between items-center mb-2">
          <span className="font-bold text-slate-800 text-sm">{system.name}</span>
          {hasIssues && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold uppercase animate-pulse">Issue</span>}
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-slate-500 font-medium">Health Status</span>
            <span className={`font-bold ${status.color}`}>{system.health}%</span>
          </div>
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full ${status.bg}`} style={{ width: `${system.health}%` }} />
          </div>
        </div>
      </div>
    );

    // Tùy chỉnh UI theo từng loại hệ thống
    switch (system.name) {
      case 'HVAC': // Nằm trên nóc tàu, mô phỏng quạt/cục nóng
        return (
          <div className="absolute top-[-14px] left-[25%] group cursor-pointer">
            <Tooltip />
            <div className="relative">
              {isPinging && (
                <>
                  <span className={`absolute -inset-2 ${status.bg} opacity-10 rounded-full`} />
                  <span className={`absolute -inset-4 ${status.bg} rounded-full animate-breathe`} />
                </>
              )}
              <div className={`w-20 h-4 bg-slate-200 border-2 border-b-0 ${status.border} rounded-t-md flex items-center justify-evenly px-1 relative z-10 overflow-hidden`}>
                 <div className="w-4 h-full bg-slate-300 border-x border-slate-400 opacity-50 flex items-center justify-center">
                    <div className={`w-2 h-2 rounded-full ${status.bg} ${status.glow}`} />
                 </div>
                 <div className="w-10 flex gap-0.5">
                   {[1,2,3,4,5].map(i => <div key={i} className="flex-1 h-3 bg-slate-800 rounded-sm" />)}
                 </div>
              </div>
            </div>
          </div>
        );

      case 'Network': // Nằm trên nóc tàu, mô phỏng ăng-ten
        return (
          <div className="absolute top-[-20px] right-[25%] group cursor-pointer">
            <Tooltip />
            <div className="relative flex flex-col items-center">
              {isPinging && (
                <>
                  <span className={`absolute -inset-2 ${status.bg} opacity-10 rounded-full`} />
                  <span className={`absolute -inset-4 ${status.bg} rounded-full animate-breathe`} />
                </>
              )}
              {/* Sóng WiFi */}
              <div className={`w-6 h-3 border-t-2 border-slate-400 rounded-t-full mb-0.5 ${hasIssues ? 'border-red-400' : ''}`} />
              <div className={`w-4 h-2 border-t-2 border-slate-400 rounded-t-full mb-0.5 ${hasIssues ? 'border-red-400' : ''}`} />
              {/* Cục thu phát */}
              <div className={`w-6 h-3 bg-slate-200 border-2 border-b-0 ${status.border} rounded-t-full flex justify-center items-end pb-0.5 relative z-10`}>
                 <div className={`w-1.5 h-1.5 rounded-full ${status.bg} ${status.glow}`} />
              </div>
            </div>
          </div>
        );

      case 'Doors': // Cửa ra vào chính giữa thân tàu
        return (
          <div className="absolute top-[10%] left-[58%] -translate-x-1/2 w-[100px] h-[80%] group cursor-pointer">
            <Tooltip />
            <div className="relative w-full h-full">
               {isPinging && (
                 <>
                   <span className={`absolute -inset-2 ${status.bg} opacity-10 rounded-md`} />
                   <span className={`absolute -inset-4 ${status.bg} rounded-md animate-breathe`} />
                 </>
               )}
               {/* Khung cửa */}
               <div className={`w-full h-full border-2 ${status.border} bg-slate-100 rounded-sm flex relative z-10`}>
                 {/* Cửa trái & Phải */}
                 <div className="flex-1 border-r border-slate-300 flex flex-col items-center pt-2 gap-1">
                    <div className="w-5 h-12 bg-slate-800 rounded-sm shadow-inner" />
                 </div>
                 <div className="flex-1 border-l border-slate-300 flex flex-col items-center pt-2 gap-1">
                    <div className="w-5 h-12 bg-slate-800 rounded-sm shadow-inner" />
                 </div>
               </div>
               {/* Đèn báo hiệu phía trên cửa */}
               <div className={`absolute -top-3 left-1/2 -translate-x-1/2 w-4 h-1.5 rounded-full ${status.bg} ${status.glow} z-20`} />
            </div>
          </div>
        );

      case 'Power': // Khung gầm chứa pin/biến áp
        return (
          <div className="absolute bottom-[-17px] right-[32%] group cursor-pointer">
            <Tooltip />
            <div className="relative">
              {isPinging && (
                <>
                  <span className={`absolute -inset-2 ${status.bg} opacity-10 rounded-full`} />
                  <span className={`absolute -inset-4 ${status.bg} rounded-full animate-breathe`} />
                </>
              )}
              <div className={`w-16 h-5 bg-slate-700 border-2 ${status.border} rounded-b-md flex items-center justify-between px-1 relative z-10`}>
                 {/* Battery cells mô phỏng */}
                 <div className={`w-3 h-2 bg-slate-600 border border-slate-500 rounded-sm`} />
                 <div className={`w-3 h-2 bg-slate-600 border border-slate-500 rounded-sm`} />
                 {/* Đèn báo Power */}
                 <div className={`w-2 h-2 rounded-full ${status.bg} ${status.glow}`} />
              </div>
            </div>
          </div>
        );

      case 'Brakes': // Cụm phanh gắn ở cụm bánh xe
        return (
          <div className="absolute bottom-[-24px] left-[20%] group cursor-pointer z-30">
            <Tooltip />
            <div className="relative flex gap-4">
              {isPinging && (
                <>
                  <span className={`absolute -inset-2 ${status.bg} opacity-10 rounded-full`} />
                  <span className={`absolute -inset-4 ${status.bg} rounded-full animate-breathe`} />
                </>
              )}
              {/* Brake Caliper trái */}
              <div className="relative z-10">
                <div className={`absolute -top-1 -right-1 w-3 h-3 ${status.bg} border border-white rounded-sm z-20 ${status.glow} rotate-45`} />
                <div className="w-10 h-10 rounded-full border-[3px] border-slate-600 bg-slate-300 flex items-center justify-center">
                  <div className="w-6 h-6 rounded-full border border-slate-400 bg-slate-200" />
                </div>
              </div>
              {/* Brake Caliper phải */}
              <div className="relative z-10">
                <div className={`absolute -top-1 -left-1 w-3 h-3 ${status.bg} border border-white rounded-sm z-20 ${status.glow} -rotate-45`} />
                <div className="w-10 h-10 rounded-full border-[3px] border-slate-600 bg-slate-300 flex items-center justify-center">
                  <div className="w-6 h-6 rounded-full border border-slate-400 bg-slate-200" />
                </div>
              </div>
            </div>
          </div>
        );

      default: return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop (Light theme thì dùng overlay sáng hơn 1 chút hoặc blur mạnh) */}
      <div className="absolute inset-0 bg-slate-800/40 backdrop-blur-md" onClick={onClose} />

      {/* Modal Content - Thay đổi shadow và màu viền cho Light Theme */}
      <div className="relative bg-white w-full max-w-7xl h-[85vh] rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.15)] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-100">
        
        {/* Header */}
        <div className="bg-white px-8 py-5 border-b border-slate-100 flex justify-between items-center z-10 shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
              <span className="bg-blue-600 text-white px-3 py-1 rounded-lg text-sm shadow-sm">{carriage.id}</span>
              {carriage.type} Carriage Diagnostics
            </h2>
            <p className="text-sm text-slate-500 mt-1">Train: <span className="font-semibold text-slate-700">{train?.name}</span> (ID: {train?.id})</p>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-50 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors border border-slate-200">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden bg-slate-50/50">
          
          {/* TRÁI: CARRIAGE BLUEPRINT (Light Theme) */}
          <div className="w-[55%] bg-white relative overflow-hidden flex items-center justify-center p-8 border-r border-slate-200">
            {/* Background Grid Pattern - Bản vẽ kỹ thuật nền sáng */}
            <div className="absolute inset-0 opacity-[0.4]" 
                 style={{ backgroundImage: 'linear-gradient(#cbd5e1 1px, transparent 1px), linear-gradient(90deg, #cbd5e1 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
            
            <div className="absolute top-6 left-6 flex items-center gap-2 bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm z-20">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
              </span>
              <span className="text-slate-700 font-bold text-xs uppercase tracking-wider">Live Schema</span>
            </div>

            {/* KHUNG TOA TÀU CHÂN THỰC */}
            <div className="relative w-full max-w-2xl aspect-[2/1] bg-gradient-to-b from-slate-50 to-slate-200 rounded-2xl border-2 border-slate-300 shadow-xl flex flex-col justify-between z-10">
              
              {/* Dải màu sơn trang trí (Speed stripe) */}
              <div className="absolute top-[60%] left-0 right-0 h-2 bg-blue-600 opacity-80" />

              {/* Các hàng Cửa Sổ */}
              <div className="flex justify-between px-10 pt-15 gap-6 absolute inset-x-0">
                 {[1,2,3].map(i => (
                   <div key={i} className="h-14 flex-1 bg-slate-800 rounded-lg border-2 border-slate-400 shadow-inner relative overflow-hidden">
                      {/* Vệt phản chiếu ánh sáng */}
                      <div className="absolute top-0 right-2 w-16 h-full bg-white/10 skew-x-12" />
                   </div>
                 ))}
                 {/* Tạo khoảng trống ở giữa cho Cửa ra vào */}
                 <div className="w-[80px]" /> 
                 {[4,5].map(i => (
                   <div key={i} className="h-14 flex-1 bg-slate-800 rounded-lg border-2 border-slate-400 shadow-inner relative overflow-hidden">
                      <div className="absolute top-0 right-2 w-16 h-full bg-white/10 skew-x-12" />
                   </div>
                 ))}
              </div>
              
              {/* Bánh xe phụ bên phải (Bánh bên trái đã được cụm Brakes cover) */}
              <div className="absolute bottom-[-20px] right-[15%] flex gap-4 z-0">
                <div className="w-10 h-10 rounded-full border-[3px] border-slate-600 bg-slate-300 flex items-center justify-center">
                   <div className="w-4 h-4 rounded-full border border-slate-400 bg-slate-200" />
                </div>
                <div className="w-10 h-10 rounded-full border-[3px] border-slate-600 bg-slate-300 flex items-center justify-center">
                   <div className="w-4 h-4 rounded-full border border-slate-400 bg-slate-200" />
                </div>
              </div>

              {/* MAPPING CÁC HỆ THỐNG GẮN LÊN TÀU */}
              {systems.map((system) => {
                const status = getHealthStatus(system.health);
                const hasIssues = rawIssues.some(i => i.system === system.name);
                return (
                  <React.Fragment key={system.id}>
                    {renderSystemUI(system, hasIssues, status)}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* PHẢI: ISSUES LIST & FILTERS */}
          <div className="w-[45%] flex flex-col bg-slate-50 relative z-10">
            
            {/* Toolbar Filters */}
            <div className="bg-white px-6 py-4 border-b border-slate-200 shrink-0 space-y-4 shadow-sm z-10">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
                  Reported Issues 
                  <span className="bg-red-100 text-red-600 px-2.5 py-0.5 rounded-full text-sm font-bold">{filteredAndSortedIssues.length}</span>
                </h3>
              </div>

              {/* Các thanh lọc */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">System</label>
                  <select className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer"
                    value={filterSystem} onChange={(e) => setFilterSystem(e.target.value)}>
                    <option value="All">All Systems</option>
                    <option value="HVAC">HVAC</option>
                    <option value="Brakes">Brakes</option>
                    <option value="Doors">Doors</option>
                    <option value="Power">Power</option>
                    <option value="Network">Network</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Priority</label>
                  <select className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer"
                    value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}>
                    <option value="All">All Priorities</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Assignee</label>
                  <select className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer"
                    value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)}>
                    {uniqueAssignees.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Sort by</label>
                  <select className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer"
                    value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                    <option value="date-desc">Newest First</option>
                    <option value="date-asc">Oldest First</option>
                    <option value="priority">Priority (High-Low)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Issues List Scrollable Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin scrollbar-thumb-slate-300">
              {filteredAndSortedIssues.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <p className="font-medium text-slate-500">No active issues found.</p>
                </div>
              ) : (
                filteredAndSortedIssues.map((issue) => (
                  <div key={issue.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all duration-200 group">
                    
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex gap-2 items-center">
                        <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">{issue.id}</span>
                        <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-md border ${getPriorityStyle(issue.priority)}`}>
                          {issue.priority}
                        </span>
                      </div>
                      <span className="text-xs font-medium text-slate-400">{issue.date}</span>
                    </div>

                    <h4 className="font-semibold text-slate-800 mb-4 text-[15px] leading-snug group-hover:text-blue-600 transition-colors">{issue.description}</h4>
                    
                    <div className="flex items-center gap-3 text-xs font-medium">
                      <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 text-slate-600 px-2.5 py-1.5 rounded-lg">
                        <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        {issue.system}
                      </div>
                      
                      <div className="flex-1" />
                      
                      <span className={`px-2.5 py-1.5 rounded-lg capitalize border ${issue.status === 'open' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                        {issue.status.replace('-', ' ')}
                      </span>
                      
                      {/* Avatar Assignee */}
                      {issue.assignee ? (
                         <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${issue.assignee.color} shadow-sm border-2 border-white cursor-help`} title={`Assigned to ${issue.assignee.name}`}>
                           {issue.assignee.initials}
                         </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-100 text-slate-500 border border-slate-300 border-dashed cursor-help" title="Unassigned">
                           ?
                        </div>
                      )}
                    </div>

                  </div>
                ))
              )}
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
}