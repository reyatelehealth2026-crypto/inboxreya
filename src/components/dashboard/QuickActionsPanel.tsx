"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, Tag, Megaphone, PackagePlus } from "lucide-react";

const actions = [
  {
    label: "เปิดกล่องข้อความ",
    description: "ดูงานที่ต้องตอบด่วน",
    href: "/inbox",
    icon: MessageSquare,
  },
  {
    label: "Orders Dashboard",
    description: "ดูสถานะออเดอร์",
    href: "/inbox/orders/dashboard",
    icon: PackagePlus,
  },
  {
    label: "Auto Reply Rules",
    description: "ตั้งค่าตอบกลับอัตโนมัติ",
    href: "/inbox/auto-reply-rules",
    icon: Megaphone,
  },
  {
    label: "Quick Reply",
    description: "จัดการข้อความลัด",
    href: "/inbox/templates",
    icon: Tag,
  },
];

export function QuickActionsPanel() {
  return (
    <Card className="border-blue-100">
      <CardHeader className="pb-2">
        <CardTitle className="text-[#1E3A8A]">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link key={action.label} href={action.href} className="block">
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 rounded-xl border border-transparent hover:border-blue-100 hover:bg-blue-50"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-left">
                  <span className="block text-sm font-semibold text-gray-900">
                    {action.label}
                  </span>
                  <span className="block text-xs text-gray-500">
                    {action.description}
                  </span>
                </span>
              </Button>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
