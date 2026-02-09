'use client'

import { ReactNode, useEffect, useState } from "react"
import { Sidebar } from "@/components/layout/Sidebar"
import { cn } from "@/lib/utils"

export default function DashboardLayoutClient({ children }: { children: ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  useEffect(() => {
    // Load initial state from localStorage
    const saved = localStorage.getItem('sidebar-collapsed')
    if (saved === 'true') {
      setSidebarCollapsed(true)
    }

    // Listen for sidebar toggle events
    const handleSidebarToggle = (e: CustomEvent) => {
      setSidebarCollapsed(e.detail.collapsed)
    }

    window.addEventListener('sidebar-toggle', handleSidebarToggle as EventListener)
    return () => {
      window.removeEventListener('sidebar-toggle', handleSidebarToggle as EventListener)
    }
  }, [])

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main 
        className={cn(
          "flex-1 min-w-0 p-6 transition-all duration-300",
          sidebarCollapsed ? "ml-16" : "ml-64"
        )}
      >
        {children}
      </main>
    </div>
  )
}
