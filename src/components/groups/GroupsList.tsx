/**
 * Groups List Component
 * Displays list of LINE groups with filtering and actions
 */

'use client';

import { useState } from 'react';
import { useGroups } from '@/hooks/use-groups';
import { GroupFilters } from '@/types/group';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Users, MessageSquare, Search, Send, LogOut } from 'lucide-react';
import Link from 'next/link';

export function GroupsList() {
  const [filters, setFilters] = useState<GroupFilters>({});
  const [searchTerm, setSearchTerm] = useState('');
  const { groups, stats, loading, error, refetch, leaveGroup } = useGroups(filters);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setFilters((prev) => ({ ...prev, search: value }));
  };

  const handleFilterChange = (key: keyof GroupFilters, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleLeaveGroup = async (groupId: number, groupName: string) => {
    if (
      !confirm(
        `ต้องการให้บอทออกจากกลุ่ม "${groupName}" หรือไม่?\n\nหมายเหตุ: บอทจะไม่สามารถกลับเข้ากลุ่มได้เอง ต้องให้สมาชิกเชิญใหม่`
      )
    ) {
      return;
    }

    const success = await leaveGroup(groupId);
    if (success) {
      alert(`ออกจากกลุ่ม ${groupName} แล้ว`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center text-red-600">
          <p>เกิดข้อผิดพลาด: {error}</p>
          <Button onClick={refetch} className="mt-4">
            ลองอีกครั้ง
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="text-3xl font-bold text-blue-600">{stats.total}</div>
            <div className="text-sm text-gray-600">กลุ่มทั้งหมด</div>
          </Card>
          <Card className="p-4">
            <div className="text-3xl font-bold text-green-600">{stats.active}</div>
            <div className="text-sm text-gray-600">กลุ่มที่ใช้งาน</div>
          </Card>
          <Card className="p-4">
            <div className="text-3xl font-bold text-purple-600">{stats.totalMembers}</div>
            <div className="text-sm text-gray-600">สมาชิกรวม</div>
          </Card>
          <Card className="p-4">
            <div className="text-3xl font-bold text-orange-600">{stats.totalMessages}</div>
            <div className="text-sm text-gray-600">ข้อความในกลุ่ม</div>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="ค้นหากลุ่ม..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Select
            value={filters.isActive?.toString() || 'all'}
            onValueChange={(value) =>
              handleFilterChange('isActive', value === 'all' ? undefined : value === 'true')
            }
          >
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="สถานะ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทั้งหมด</SelectItem>
              <SelectItem value="true">ใช้งาน</SelectItem>
              <SelectItem value="false">ออกแล้ว</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={filters.groupType || 'all'}
            onValueChange={(value) =>
              handleFilterChange('groupType', value === 'all' ? undefined : value)
            }
          >
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="ประเภท" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทั้งหมด</SelectItem>
              <SelectItem value="group">Group</SelectItem>
              <SelectItem value="room">Room</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Groups List */}
      <Card>
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="font-semibold">รายการกลุ่ม</h3>
          <span className="text-sm text-gray-500">{groups.length} กลุ่ม</span>
        </div>

        {groups.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Users className="h-12 w-12 mx-auto mb-2 text-gray-300" />
            <p>ยังไม่มีกลุ่มที่บอทเข้าร่วม</p>
            <p className="text-sm mt-2">เมื่อมีคนเชิญบอทเข้ากลุ่ม จะแสดงที่นี่</p>
          </div>
        ) : (
          <div className="divide-y">
            {groups.map((group) => (
              <div key={group.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-4">
                  {/* Group Avatar */}
                  <div className="flex-shrink-0">
                    {group.pictureUrl ? (
                      <img
                        src={group.pictureUrl}
                        alt={group.groupName || 'Group'}
                        className="w-12 h-12 rounded-full"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                        <Users className="h-6 w-6 text-gray-400" />
                      </div>
                    )}
                  </div>

                  {/* Group Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium truncate">
                        {group.groupName || 'Unknown Group'}
                      </h4>
                      <Badge variant={group.isActive ? 'default' : 'secondary'}>
                        {group.isActive ? 'Active' : 'Left'}
                      </Badge>
                      <Badge variant="outline">{group.groupType}</Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {group.memberCount} สมาชิก
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-4 w-4" />
                        {group.totalMessages} ข้อความ
                      </span>
                      <span>
                        เข้าร่วม: {new Date(group.joinedAt).toLocaleDateString('th-TH')}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Link href={`/inbox/groups/${group.id}`}>
                      <Button variant="ghost" size="sm" title="ดูรายละเอียด">
                        <Search className="h-4 w-4" />
                      </Button>
                    </Link>
                    {group.isActive && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-green-600 hover:text-green-700"
                          title="ส่งข้อความ"
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => handleLeaveGroup(group.id, group.groupName || 'กลุ่ม')}
                          title="ออกจากกลุ่ม"
                        >
                          <LogOut className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
