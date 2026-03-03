"use client";

import { 
  Clock, 
  Loader2, 
  PauseCircle, 
  CheckCircle2, 
  AlertCircle 
} from "lucide-react";
import { WorkSummaryData } from "@/lib/work/queries";

interface WorkSummaryProps {
  data: WorkSummaryData;
  isLoading?: boolean;
}

const summaryCards = [
  {
    key: "totalPending" as const,
    label: "รอดำเนินการ",
    icon: Clock,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
  },
  {
    key: "inProgress" as const,
    label: "กำลังทำ",
    icon: Loader2,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
  },
  {
    key: "waitingResponse" as const,
    label: "รอตอบกลับ",
    icon: PauseCircle,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
  },
  {
    key: "completedToday" as const,
    label: "เสร็จสิ้นวันนี้",
    icon: CheckCircle2,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
  },
];

export function WorkSummary({ data, isLoading }: WorkSummaryProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {summaryCards.map((card) => {
        const Icon = card.icon;
        const value = data[card.key];
        
        return (
          <div
            key={card.key}
            className={`
              relative overflow-hidden rounded-xl border ${card.borderColor} ${card.bgColor}
              p-4 transition-all duration-200 hover:shadow-md
            `}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{card.label}</p>
                <div className="mt-2 flex items-baseline gap-2">
                  {isLoading ? (
                    <div className="h-8 w-16 animate-pulse rounded bg-gray-200" />
                  ) : (
                    <span className={`text-3xl font-bold ${card.color}`}>
                      {value}
                    </span>
                  )}
                </div>
              </div>
              <div className={`rounded-lg p-2 ${card.bgColor} ${card.color}`}>
                <Icon className="h-5 w-5" />
              </div>
            </div>
            
            {/* Urgent badge for pending */}
            {card.key === "totalPending" && data.urgentCount > 0 && !isLoading && (
              <div className="mt-3 flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                <span className="text-xs font-medium text-red-600">
                  {data.urgentCount} รายการด่วน
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
