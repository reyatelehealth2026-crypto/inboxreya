/**
 * Inbox Layout Component
 * Main layout with sidebar and content area
 */

'use client';

import { Sidebar } from './Sidebar';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';

interface InboxLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export function InboxLayout({ children, className }: InboxLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Listen for sidebar toggle events
  useEffect(() => {
    const handleSidebarToggle = (e: CustomEvent<{ collapsed: boolean }>) => {
      setSidebarCollapsed(e.detail.collapsed);
    };

    window.addEventListener('sidebar-toggle', handleSidebarToggle as EventListener);
    
    // Check initial state from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebar-collapsed');
      if (saved === 'true') {
        setSidebarCollapsed(true);
      }
    }

    return () => {
      window.removeEventListener('sidebar-toggle', handleSidebarToggle as EventListener);
    };
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      
      {/* Main Content */}
      <main
        className={cn(
          'flex-1 overflow-y-auto overflow-x-hidden transition-all duration-300 min-w-0',
          sidebarCollapsed ? 'ml-16' : 'ml-64',
          className
        )}
      >
        {children}
      </main>
    </div>
  );
}
