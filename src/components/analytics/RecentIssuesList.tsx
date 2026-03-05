'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RecentIssue } from '@/lib/analytics/types';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Package, Tag, DollarSign, HeadphonesIcon, HelpCircle, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { th } from 'date-fns/locale';

interface RecentIssuesListProps {
  issues: RecentIssue[];
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  delivery: Package,
  product: Tag,
  price: DollarSign,
  service: HeadphonesIcon,
  other: HelpCircle
};

const CATEGORY_LABELS: Record<string, string> = {
  delivery: 'การจัดส่ง',
  product: 'สินค้า',
  price: 'ราคา',
  service: 'บริการ',
  other: 'อื่นๆ'
};

const URGENCY_COLORS = {
  high: 'bg-red-100 text-red-800 border-red-200',
  medium: 'bg-amber-100 text-amber-800 border-amber-200',
  low: 'bg-blue-100 text-blue-800 border-blue-200'
};

const URGENCY_LABELS = {
  high: 'สูง',
  medium: 'ปานกลาง',
  low: 'ต่ำ'
};

export function RecentIssuesList({ issues }: RecentIssuesListProps) {
  return (
    <Card className="col-span-2 border-blue-100">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[#1E3A8A]">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          ปัญหาที่ตรวจพบล่าสุด (AI)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {issues.length > 0 ? (
          <div className="space-y-3">
            {issues.map((issue) => {
              const Icon = CATEGORY_ICONS[issue.category] || HelpCircle;
              const bgColor = getCategoryBgColor(issue.category);
              
              return (
                <div
                  key={issue.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className={`p-2 rounded-lg ${bgColor}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">
                        {issue.userName || 'ไม่ระบุชื่อ'}
                      </span>
                      
                      <Badge variant="outline" className={URGENCY_COLORS[issue.urgency as keyof typeof URGENCY_COLORS] || URGENCY_COLORS.low}>
                        ความเร่งด่วน: {URGENCY_LABELS[issue.urgency as keyof typeof URGENCY_LABELS] || URGENCY_LABELS.low}
                      </Badge>
                      
                      <Badge variant="outline" className="bg-gray-100">
                        {CATEGORY_LABELS[issue.category] || issue.category}
                      </Badge>
                    </div>
                    
                    <p className="text-sm text-gray-600 mt-1 truncate">
                      &ldquo;{issue.message}&rdquo;
                    </p>
                    
                    <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(issue.detectedAt), {
                        addSuffix: true,
                        locale: th
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-gray-500">
            <AlertTriangle className="h-12 w-12 mb-3 opacity-30" />
            <p>ยังไม่มีปัญหาที่ตรวจพบ</p>
            <p className="text-sm text-gray-400">AI จะวิเคราะห์ข้อความใหม่อัตโนมัติ</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function getCategoryBgColor(category: string): string {
  const colors: Record<string, string> = {
    delivery: 'bg-red-100 text-red-600',
    product: 'bg-amber-100 text-amber-600',
    price: 'bg-blue-100 text-blue-600',
    service: 'bg-purple-100 text-purple-600',
    other: 'bg-gray-100 text-gray-600'
  };
  return colors[category] || colors.other;
}
