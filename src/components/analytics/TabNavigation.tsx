'use client';

import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  TrendingUp, 
  Users, 
  BrainCircuit 
} from 'lucide-react';

export type AnalyticsTab = 'overview' | 'sales' | 'customers' | 'ai-insights';

interface TabNavigationProps {
  activeTab: AnalyticsTab;
  onTabChange: (tab: AnalyticsTab) => void;
}

const tabs: { id: AnalyticsTab; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'ภาพรวม', icon: LayoutDashboard },
  { id: 'sales', label: 'ยอดขาย', icon: TrendingUp },
  { id: 'customers', label: 'ลูกค้า', icon: Users },
  { id: 'ai-insights', label: 'AI Insights', icon: BrainCircuit }
];

export function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  return (
    <div className="border-b border-gray-200 mb-6">
      <nav className="flex space-x-1" aria-label="Tabs">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors relative',
                isActive
                  ? 'text-blue-600'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full" />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
