"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

export interface RiskAlertItem {
  label: string;
  level: "high" | "medium" | "low";
}

interface RiskAlertsListProps {
  alerts: RiskAlertItem[];
}

const levelStyle: Record<string, string> = {
  high: "text-rose-600",
  medium: "text-amber-600",
  low: "text-emerald-600",
};

export function RiskAlertsList({ alerts }: RiskAlertsListProps) {
  return (
    <Card className="border-rose-100">
      <CardHeader className="flex flex-row items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-rose-500" />
        <CardTitle className="text-rose-700">Risk Alerts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {alerts.length > 0 ? (
          alerts.map((alert) => (
            <div key={alert.label} className={`text-sm ${levelStyle[alert.level]}`}>
              • {alert.label}
            </div>
          ))
        ) : (
          <div className="text-sm text-gray-500">ไม่มีแจ้งเตือนเร่งด่วน</div>
        )}
      </CardContent>
    </Card>
  );
}
