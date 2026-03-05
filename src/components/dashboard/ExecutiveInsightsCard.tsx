"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lightbulb } from "lucide-react";

interface ExecutiveInsightsCardProps {
  insights: string[];
}

export function ExecutiveInsightsCard({ insights }: ExecutiveInsightsCardProps) {
  return (
    <Card className="border-blue-100">
      <CardHeader className="flex flex-row items-center gap-2">
        <Lightbulb className="h-4 w-4 text-amber-500" />
        <CardTitle className="text-[#1E3A8A]">Executive Insights</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {insights.length > 0 ? (
          insights.map((item) => (
            <div key={item} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-gray-700">
              {item}
            </div>
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-2 text-sm text-gray-500">
            ยังไม่มีข้อมูลเชิงลึกสำหรับช่วงเวลานี้
          </div>
        )}
      </CardContent>
    </Card>
  );
}
