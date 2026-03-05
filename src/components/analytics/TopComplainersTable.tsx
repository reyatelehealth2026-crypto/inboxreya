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
import { TopComplainer } from '@/lib/analytics/types';
import { AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { th } from 'date-fns/locale';

interface TopComplainersTableProps {
  complainers: TopComplainer[];
}

export function TopComplainersTable({ complainers }: TopComplainersTableProps) {
  return (
    <Card className="border-blue-100">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[#1E3A8A]">
          <AlertCircle className="h-5 w-5 text-amber-500" />
          ลูกค้าที่ร้องเรียนบ่อย
        </CardTitle>
      </CardHeader>
      <CardContent>
        {complainers.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow className="bg-blue-50/50">
                <TableHead className="w-12 text-[#1E3A8A]">#</TableHead>
                <TableHead className="text-[#1E3A8A]">ชื่อ</TableHead>
                <TableHead className="text-right text-[#1E3A8A]">จำนวนร้องเรียน</TableHead>
                <TableHead className="text-[#1E3A8A]">ร้องเรียนล่าสุด</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {complainers.map((complainer, index) => (
                <TableRow 
                  key={complainer.userId}
                  className="hover:bg-blue-50/30 transition-colors"
                >
                  <TableCell className="font-medium text-[#1E3A8A]">
                    {index + 1}
                  </TableCell>
                  <TableCell className="font-medium">
                    {complainer.userName || 'ไม่ระบุชื่อ'}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="inline-flex items-center justify-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      {complainer.complaintCount}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {formatDistanceToNow(new Date(complainer.lastComplaintAt), {
                      addSuffix: true,
                      locale: th
                    })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-gray-500">
            <AlertCircle className="h-12 w-12 mb-3 opacity-30" />
            <p>ยังไม่มีข้อมูลการร้องเรียน</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
