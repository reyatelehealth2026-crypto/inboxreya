'use client'

import { ReactNode, useEffect, useState } from "react"
import { Sidebar } from "@/components/layout/Sidebar"
import { SkipNavigation } from "@/components/accessibility/SkipNavigation"
import { cn } from "@/lib/utils"

export default function InboxLayoutClient({ children }: { children: ReactNode }) {
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
      <SkipNavigation />
      <Sidebar />
      <main 
        id="main-content"
        className={cn(
          "flex-1 min-w-0 h-screen overflow-hidden transition-all duration-300",
          sidebarCollapsed ? "ml-16" : "ml-64"
        )}
      >
        {children}
      </main>
    </div>
  )
}
