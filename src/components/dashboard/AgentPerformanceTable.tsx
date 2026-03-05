"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const mockAgents = [
  { name: "ทีม Sales A", sla: "12m", status: "good" },
  { name: "ทีม Sales B", sla: "18m", status: "warning" },
  { name: "ทีม Sales C", sla: "24m", status: "risk" },
];

const statusStyles: Record<string, string> = {
  good: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  risk: "bg-rose-100 text-rose-700",
};

export function AgentPerformanceTable() {
  return (
    <Card className="border-blue-100">
      <CardHeader className="pb-2">
        <CardTitle className="text-[#1E3A8A]">SLA ทีมงาน</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {mockAgents.map((agent) => (
          <div key={agent.name} className="flex items-center justify-between rounded-lg border border-slate-100 bg-white px-3 py-2">
            <div>
              <p className="text-sm font-medium text-gray-900">{agent.name}</p>
              <p className="text-xs text-gray-500">Avg response time</p>
            </div>
            <Badge className={statusStyles[agent.status]}>{agent.sla}</Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
