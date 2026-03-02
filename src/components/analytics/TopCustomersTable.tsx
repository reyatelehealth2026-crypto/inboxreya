'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { TopCustomer } from '@/lib/analytics/types';
import { formatCurrency } from '@/lib/utils';
import { Trophy } from 'lucide-react';

interface TopCustomersTableProps {
  customers: TopCustomer[];
}

export function TopCustomersTable({ customers }: TopCustomersTableProps) {
  return (
    <Card className="col-span-2 border-blue-100">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[#1E3A8A]">
          <Trophy className="h-5 w-5 text-amber-500" />
          ลูกค้ายอดซื้อสูงสุด
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="bg-blue-50/50">
              <TableHead className="w-12 text-[#1E3A8A]">#</TableHead>
              <TableHead className="text-[#1E3A8A]">ชื่อร้าน</TableHead>
              <TableHead className="text-[#1E3A8A]">รหัสสมาชิก</TableHead>
              <TableHead className="text-right text-[#1E3A8A]">ยอดซื้อ</TableHead>
              <TableHead className="text-right text-[#1E3A8A]">ออเดอร์</TableHead>
              <TableHead className="text-[#1E3A8A]">ระดับ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((customer, index) => (
              <TableRow 
                key={customer.memberId}
                className="hover:bg-blue-50/30 transition-colors"
              >
                <TableCell className="font-medium text-[#1E3A8A]">
                  {index + 1}
                </TableCell>
                <TableCell className="font-medium">
                  {customer.name || 'ไม่ระบุชื่อ'}
                </TableCell>
                <TableCell className="font-mono text-sm text-slate-600">
                  {customer.memberId}
                </TableCell>
                <TableCell className="text-right font-medium text-[#1E3A8A]">
                  {formatCurrency(customer.totalSpent)}
                </TableCell>
                <TableCell className="text-right">
                  {customer.orderCount}
                </TableCell>
                <TableCell>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    customer.tier === 'vip' ? 'bg-amber-100 text-amber-800' :
                    customer.tier === 'gold' ? 'bg-blue-100 text-blue-800' :
                    customer.tier === 'silver' ? 'bg-slate-100 text-slate-800' :
                    'bg-amber-50 text-amber-700'
                  }`}>
                    {customer.tier.toUpperCase()}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
