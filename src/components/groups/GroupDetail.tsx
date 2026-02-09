/**
 * Group Detail Component
 * Displays detailed information about a LINE group
 */

'use client';

import { useGroupDetail } from '@/hooks/use-group-detail';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, MessageSquare, ArrowLeft, User, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { syncGroupMembers } from '@/actions/sync-group-members';
import { GroupChat } from './GroupChat';

interface GroupDetailProps {
  groupId: number;
}

export function GroupDetail({ groupId }: GroupDetailProps) {
  const { group, members, messages, loading, error, loadMoreMessages, hasMoreMessages, refetch } =
    useGroupDetail(groupId);
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();

  const handleSyncMembers = async () => {
    setSyncing(true);
    try {
      console.log('=== SYNC MEMBERS BUTTON CLICKED ===');
      console.log('Group ID:', groupId);
      
      // ใช้ Server Action แทน API route เพราะ auth ทำงานได้ดีกว่าใน Next.js 15
      const data = await syncGroupMembers(groupId);
      
      console.log('Sync result:', data);

      if (data.success) {
        toast({
          title: 'สำเร็จ',
          description: data.message || `ซิงค์สมาชิกเรียบร้อยแล้ว (${data.data?.syncedCount || 0} คน)`,
        });
        
        // Force refetch with cache invalidation
        console.log('Refetching data...');
        await refetch();
        console.log('Refetch complete');
      } else {
        console.error('Sync failed:', data.error);
        toast({
          title: 'เกิดข้อผิดพลาด',
          description: data.error || 'ไม่สามารถซิงค์สมาชิกได้',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('=== SYNC MEMBERS ERROR ===');
      console.error('Error:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: error instanceof Error ? error.message : 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้',
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (error || !group) {
    return (
      <Card className="p-6">
        <div className="text-center text-red-600">
          <p>เกิดข้อผิดพลาด: {error || 'ไม่พบข้อมูลกลุ่ม'}</p>
          <Link href="/inbox/groups">
            <Button className="mt-4">กลับไปรายการกลุ่ม</Button>
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link href="/inbox/groups">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-2" />
          กลับไปรายการกลุ่ม
        </Button>
      </Link>

      {/* Group Info */}
      <Card className="p-6">
        <div className="flex items-start gap-4">
          {group.pictureUrl ? (
            <img
              src={group.pictureUrl}
              alt={group.groupName || 'Group'}
              className="w-20 h-20 rounded-full"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center">
              <Users className="h-10 w-10 text-gray-400" />
            </div>
          )}

          <div className="flex-1">
            <h1 className="text-2xl font-bold mb-2">{group.groupName || 'Unknown Group'}</h1>
            <div className="flex items-center gap-2 mb-3">
              <Badge variant={group.isActive ? 'default' : 'secondary'}>
                {group.isActive ? 'Active' : 'Left'}
              </Badge>
              <Badge variant="outline">{group.groupType}</Badge>
            </div>

            <div className="flex gap-6 text-sm">
              <div>
                <div className="text-2xl font-bold text-blue-600">{group.memberCount}</div>
                <div className="text-gray-600">สมาชิก</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{group.totalMessages}</div>
                <div className="text-gray-600">ข้อความ</div>
              </div>
            </div>

            <div className="mt-3 text-sm text-gray-600">
              เข้าร่วมเมื่อ: {new Date(group.joinedAt).toLocaleString('th-TH')}
            </div>
          </div>
        </div>
      </Card>

      {/* Tabs: Chat, Members, Info */}
      <Tabs defaultValue="chat" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="chat">
            <MessageSquare className="h-4 w-4 mr-2" />
            แชท
          </TabsTrigger>
          <TabsTrigger value="members">
            <Users className="h-4 w-4 mr-2" />
            สมาชิก ({members.length})
          </TabsTrigger>
          <TabsTrigger value="info">ข้อมูล</TabsTrigger>
        </TabsList>

        {/* Chat Tab */}
        <TabsContent value="chat" className="mt-6">
          <Card className="h-[600px]">
            <GroupChat
              groupId={groupId}
              groupName={group.groupName || 'Unknown Group'}
              messages={messages.map(msg => ({
                ...msg,
                lineMessageId: msg.messageId || '',
                createdAt: msg.createdAt.toString(),
              }))}
              members={members}
              onRefresh={refetch}
            />
          </Card>
        </TabsContent>

        {/* Members Tab */}
        <TabsContent value="members" className="mt-6">
          <Card>
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <Users className="h-5 w-5" />
                สมาชิก ({members.length})
              </h3>
              {group.isActive && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSyncMembers}
                  disabled={syncing}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'กำลังซิงค์...' : 'ซิงค์จาก LINE'}
                </Button>
              )}
            </div>
            <div className="p-4 max-h-96 overflow-y-auto">
              {members.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">ยังไม่มีข้อมูลสมาชิก</p>
                  {group.isActive && (
                    <Button onClick={handleSyncMembers} disabled={syncing}>
                      <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                      {syncing ? 'กำลังซิงค์...' : 'ซิงค์สมาชิกจาก LINE API'}
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className={`flex items-center gap-3 p-2 rounded-lg ${
                        member.isActive ? 'bg-gray-50' : 'bg-red-50'
                      }`}
                    >
                      {member.pictureUrl ? (
                        <img
                          src={member.pictureUrl}
                          alt={member.displayName || 'Member'}
                          className="w-10 h-10 rounded-full"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                          <User className="h-5 w-5 text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {member.displayName || 'Unknown'}
                        </div>
                        <div className="text-xs text-gray-500">
                          ข้อความ: {member.totalMessages}
                          {member.lastMessageAt && (
                            <> • ล่าสุด: {new Date(member.lastMessageAt).toLocaleDateString('th-TH')}</>
                          )}
                        </div>
                      </div>
                      {!member.isActive && (
                        <Badge variant="secondary" className="text-xs">
                          ออกแล้ว
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </TabsContent>

        {/* Info Tab */}
        <TabsContent value="info" className="mt-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">ข้อมูลกลุ่ม</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">LINE Group ID:</span>
                <span className="font-mono text-xs">{group.groupId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">ประเภท:</span>
                <Badge variant="outline">{group.groupType}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">สถานะ:</span>
                <Badge variant={group.isActive ? 'default' : 'secondary'}>
                  {group.isActive ? 'Active' : 'Left'}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">จำนวนสมาชิก:</span>
                <span className="font-semibold">{group.memberCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">จำนวนข้อความ:</span>
                <span className="font-semibold">{group.totalMessages}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">เข้าร่วมเมื่อ:</span>
                <span>{new Date(group.joinedAt).toLocaleString('th-TH')}</span>
              </div>
              {group.leftAt && (
                <div className="flex justify-between">
                  <span className="text-gray-600">ออกจากกลุ่มเมื่อ:</span>
                  <span>{new Date(group.leftAt).toLocaleString('th-TH')}</span>
                </div>
              )}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
