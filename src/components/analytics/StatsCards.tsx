'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SalesStats } from '@/lib/analytics/types';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { TrendingUp, Users, ShoppingCart, Package } from 'lucide-react';

interface StatsCardsProps {
  stats: SalesStats;
}

export function StatsCards({ stats }: StatsCardsProps) {
  const cards = [
    {
      title: 'รายได้รวม',
      value: formatCurrency(stats.totalRevenue),
      icon: TrendingUp,
      color: 'text-blue-700',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-100'
    },
    {
      title: 'จำนวนลูกค้า',
      value: formatNumber(stats.totalCustomers),
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50/80',
      borderColor: 'border-blue-100'
    },
    {
      title: 'มูลค่าออเดอร์เฉลี่ย',
      value: formatCurrency(stats.avgOrderValue),
      icon: ShoppingCart,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-100'
    },
    {
      title: 'จำนวนออเดอร์',
      value: formatNumber(stats.totalOrders),
      icon: Package,
      color: 'text-blue-500',
      bgColor: 'bg-blue-50/60',
      borderColor: 'border-blue-100'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card 
          key={card.title} 
          className={`border ${card.borderColor} hover:shadow-md transition-shadow duration-200 cursor-pointer`}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-[#1E3A8A]">
              {card.title}
            </CardTitle>
            <div className={`p-2 rounded-lg ${card.bgColor}`}>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#1E3A8A]">{card.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
