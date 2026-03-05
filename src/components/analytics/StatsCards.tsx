'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SalesStats } from '@/lib/analytics/types';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { TrendingUp, Users, ShoppingCart, Package, Smile } from 'lucide-react';

interface StatsCardsProps {
  stats: SalesStats & { avgSentiment?: number };
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
      title: 'จำนวนออเดอร์',
      value: formatNumber(stats.totalOrders),
      icon: Package,
      color: 'text-blue-500',
      bgColor: 'bg-blue-50/60',
      borderColor: 'border-blue-100'
    },
    {
      title: 'คะแนนความพึงพอใจ',
      value: `${stats.avgSentiment ?? 50}%`,
      icon: Smile,
      color: getSentimentColor(stats.avgSentiment ?? 50),
      bgColor: getSentimentBgColor(stats.avgSentiment ?? 50),
      borderColor: getSentimentBorderColor(stats.avgSentiment ?? 50)
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

function getSentimentColor(score: number): string {
  if (score >= 70) return 'text-green-600';
  if (score >= 50) return 'text-yellow-600';
  return 'text-red-600';
}

function getSentimentBgColor(score: number): string {
  if (score >= 70) return 'bg-green-50';
  if (score >= 50) return 'bg-yellow-50';
  return 'bg-red-50';
}

function getSentimentBorderColor(score: number): string {
  if (score >= 70) return 'border-green-100';
  if (score >= 50) return 'border-yellow-100';
  return 'border-red-100';
}
