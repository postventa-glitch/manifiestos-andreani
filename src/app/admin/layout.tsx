'use client'

import AdminNav from '@/components/AdminNav'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-4 sm:p-8 pb-16">
      <AdminNav basePath="/admin" />
      <div className="max-w-[1000px] mx-auto bg-white rounded-b-[10px] shadow-[0_8px_40px_rgba(26,46,90,0.12)] min-h-[400px]">
        {children}
      </div>
    </div>
  )
}
