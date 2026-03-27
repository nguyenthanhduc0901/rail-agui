import React, { useState } from 'react'
import { trains, getCarriagesByTrain } from '../data/railDataAdapter'
import { CarriageDetailsModal } from '../components/CarriageDetailsModal'

// --- CẤU HÌNH ---
const statusConfig = {
  healthy: { dot: 'bg-emerald-400', text: 'text-emerald-600', progress: 'bg-emerald-500', label: 'Healthy', bg: 'bg-[#AFEEEE] border-[#7BCFCF]' },
  warning: { dot: 'bg-amber-400', text: 'text-amber-600', progress: 'bg-amber-500', label: 'Warning', bg: 'bg-[#AFEEEE] border-[#7BCFCF]' },
  critical: { dot: 'bg-red-400', text: 'text-red-600', progress: 'bg-red-500', label: 'Critical', bg: 'bg-[#AFEEEE] border-[#7BCFCF]' },
}
  
// --- COMPONENT BÁNH XE (Đã bo tròn & làm nhạt màu) ---
const TrainBogie = ({ className }) => (
  // Dùng rounded-full để bo tròn cụm bánh xe, đổi bg-slate-800 -> bg-slate-500
  <div className={`absolute -bottom-3 flex gap-1 bg-slate-600 p-1.5 rounded-full z-10 shadow-sm ${className}`}>
    <div className="w-4 h-4 rounded-full bg-slate-200 border-[3px] border-slate-600" />
    <div className="w-4 h-4 rounded-full bg-slate-200 border-[3px] border-slate-600" />
  </div>
)

const CarriageWindow = () => (
  <div className="relative flex-1 h-8 bg-slate-800/90 rounded-sm border border-slate-700/60 shadow-inner">
    <div className="absolute top-1 right-2 w-5 h-1 bg-white/20 rounded-full" />
  </div>
)

export function FleetDashboard() {
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedTrain, setSelectedTrain] = useState(null)
  const [selectedCarriage, setSelectedCarriage] = useState(null)

  const openModal = (train, carriage) => {
    setSelectedTrain(train)
    setSelectedCarriage(carriage)
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setSelectedTrain(null)
    setSelectedCarriage(null)
  }

  return (
    <section className="space-y-12 pb-12">
      {/* FLEET HEADER */}
      <div className="flex justify-between items-end">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Live Train Fleet</h2>
      </div>

      {/* DANH SÁCH CÁC ĐOÀN TÀU */}
      <div className="space-y-16">
        {trains.map((train) => {
          const config = statusConfig[train.status]
          const carriages = getCarriagesByTrain(train.id)
          const headCarriage = carriages[0]
          const remainingCarriages = carriages.slice(1)
          const headCarriageConfig = headCarriage ? statusConfig[headCarriage.status] : config

          return (
            <div key={train.id} className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
              
              {/* Header của từng đoàn tàu */}
              <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${config.dot} animate-pulse`} />
                  <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">{train.name} <span className="ml-2 text-sm font-normal text-slate-500 dark:text-slate-400">(ID: {train.id})</span></h3>
                </div>
                
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-xs text-slate-500 uppercase font-bold tracking-wider dark:text-slate-400">Efficiency</p>
                    <p className="font-bold text-slate-800 dark:text-slate-100">{train.efficiency}%</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500 uppercase font-bold tracking-wider dark:text-slate-400">Issues</p>
                    <p className={`font-bold ${config.text}`}>{train.openIssues}</p>
                  </div>

                </div>
              </div>

              {/* Khu vực vẽ đoàn tàu */}
              <div className="relative pt-4">
                {/* Scroll Wrapper */}
                <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
                  <div className="flex items-end gap-0 relative w-max min-w-full px-4 pb-[20px] pt-2">
                    
                    {/* ĐƯỜNG RAY THỰC TẾ */}
                    <div className="absolute bottom-0 left-0 right-0 z-0 flex flex-col pointer-events-none h-[16px]">
                      <div className="w-full h-[4px] bg-slate-400 border-b border-slate-500 shadow-sm" />
                      <div 
                        className="w-full h-[6px] mt-[1px]"
                        style={{
                          backgroundImage: 'repeating-linear-gradient(90deg, #475569 0px, #475569 10px, transparent 10px, transparent 22px)'
                        }}
                      />
                      <div className="w-full h-[4px] bg-slate-200/80 rounded-full mt-[1px]" />
                    </div>

{/* ĐẦU TÀU (Electric Locomotive - Aerodynamic Design) */}
<div
  className="relative flex-shrink-0 h-40 w-64 group cursor-pointer transition-transform hover:-translate-y-1 z-10 block"
  onClick={() => headCarriage && openModal(train, headCarriage)}
>
  
  {/* 1. THÂN TÀU: Tạo hình mũi tàu điện thuôn dài */}
  <div className={`absolute inset-0 border-2 ${headCarriageConfig.bg} rounded-tl-[100px] rounded-bl-2xl rounded-r-lg overflow-hidden shadow-md flex flex-col`}>
    
    {/* Kính chắn gió (Windshield) - To và vát theo mũi tàu */}
    <div className="absolute top-2 left-7 w-24 h-14 bg-slate-800/90 rounded-tl-[80px] rounded-tr-md rounded-bl-lg border-r-2 border-b-2 border-slate-700/50 shadow-inner flex items-center justify-center">
      {/* Hiệu ứng bóng đổ trên kính */}
      <div className="absolute top-2 right-4 w-8 h-1 bg-white/20 rounded-full rotate-[-10deg]" />
    </div>

    {/* Đèn pha (Headlights) - Đặc trưng của tàu điện hiện đại */}
    <div className="absolute bottom-6 left-6 flex gap-3">
      <div className="w-4 h-2 bg-amber-200 rounded-full shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
      <div className="w-4 h-2 bg-amber-200 rounded-full shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
    </div>

    {/* Đường kẻ trang trí (Speed stripes) - Tạo cảm giác tốc độ */}
    <div className="absolute top-20 left-12 right-0 h-1 bg-white/30" />
    <div className="absolute top-[88px] left-20 right-0 h-1 bg-white/20" />

    <div className="absolute left-0 right-0 top-16 px-5 pointer-events-none">
      <div className="flex justify-between items-end mb-2">
        <span className="text-[10px] font-bold text-slate-700 bg-white/50 px-1.5 py-0.5 rounded">
          {headCarriage?.type ?? 'Head'}
        </span>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between items-center text-[9px] text-slate-600">
          <span>Issues</span>
          <span className="font-bold">{headCarriage?.issues ?? 0}</span>
        </div>
        <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div
            className={`h-full ${headCarriageConfig.progress} rounded-full`}
            style={{ width: `${Math.min((headCarriage?.issues ?? 0) * 20, 100)}%` }}
          />
        </div>
      </div>
    </div>

    <div className="flex-1" />
    
    {/* Gầm tàu */}
    <div className="h-3 w-full bg-slate-500 border-t border-slate-400" />
  </div>

  {/* 2. CẦN LẤY ĐIỆN (Pantograph) - Chi tiết khẳng định đây là tàu điện */}
  <div className="absolute -top-6 left-1/2 w-12 h-8 pointer-events-none">
    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-slate-600" />
    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-6 bg-slate-500 origin-bottom rotate-[30deg]" />
    <div className="absolute bottom-5 left-[60%] w-6 h-1 bg-slate-400 -rotate-[60deg]" />
    <div className="absolute top-0 left-[35%] w-8 h-0.5 bg-slate-700 shadow-sm" />
  </div>
  
  {/* 3. BÁNH XE */}
  <TrainBogie className="left-[25%]" />
  <TrainBogie className="right-[15%]" />
</div>

                    {/* CÁC TOA TÀU VÀ ĐUÔI TÀU */}
                    {remainingCarriages.map((carriage, index) => {
                      const carriageConfig = statusConfig[carriage.status]
                      const isLast = index === remainingCarriages.length - 1
                      const shapeClasses = isLast ? "rounded-r-[3rem] rounded-l-lg" : "rounded-lg"

                      return (
                        <React.Fragment key={carriage.id}>
                          {/* Khớp nối */}
                          <div className="w-4 h-3 bg-slate-600 mb-6 flex-shrink-0 border-y border-slate-500 shadow-sm z-0" />

                          {/* Toa xe */}
                          {/* Tương tự đầu tàu */}
                          <div 
                            className="relative flex-shrink-0 h-40 w-44 cursor-pointer transition-transform hover:-translate-y-1 group z-10 block"
                            onClick={() => openModal(train, carriage)}
                          >
                            
                            {/* LỚP 1: KHUNG THÂN TOA TÀU */}
                            <div className={`absolute inset-0 border-2 ${carriageConfig.bg} ${shapeClasses} overflow-hidden shadow-md flex flex-col`}>
                              <div className="absolute top-6 left-0 right-0 px-4 flex gap-2">
                                <CarriageWindow />
                                <CarriageWindow />
                                {!isLast && <CarriageWindow />}
                              </div>
                              <div className="absolute left-0 right-0 bottom-10 px-4 pointer-events-none">
                                <div className="flex justify-between items-end mb-2">
                                  <span className="text-[10px] font-bold text-slate-700 bg-white/50 px-1.5 py-0.5 rounded">{carriage.type}</span>
                                </div>
                                <div className="space-y-1">
                                  <div className="flex justify-between items-center text-[9px] text-slate-600">
                                    <span>Issues</span>
                                    <span className="font-bold">{carriage.issues}</span>
                                  </div>
                                  <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                    <div className={`h-full ${carriageConfig.progress} rounded-full`} style={{ width: `${Math.min(carriage.issues * 20, 100)}%` }} />
                                  </div>
                                </div>
                              </div>
                              
                              {/* Empty space push */}
                              <div className="flex-1" />

                              {/* Gầm toa tàu: Đã xóa style inline, tự động cắt theo viền */}
                              <div className="h-3 w-full bg-slate-500 border-t border-slate-400" />
                            </div>
                            
                            {/* LỚP 2: BÁNH XE */}
                            <TrainBogie className="left-[15%]" />
                            <TrainBogie className="right-[15%]" />
                          </div>
                        </React.Fragment>
                      )
                    })}
                  </div>
                </div>

              </div>
            </div>
          )
        })}
      </div>

      {/* Modal Component */}
      <CarriageDetailsModal 
        isOpen={modalOpen}
        onClose={closeModal}
        train={selectedTrain}
        carriage={selectedCarriage}
      />
    </section>
  )
}