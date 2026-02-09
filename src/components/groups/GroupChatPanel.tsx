/**
 * Group Chat Panel Component
 * Main chat interface for LINE group conversations
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Send,
  Image as ImageIcon,
  Paperclip,
  Smile,
  Users,
  MoreVertical,
  RefreshCw,
  LogOut,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { sendGroupMessage } from '@/actions/send-group-message';
import { syncGroupMembers } from '@/actions/sync-group-members';
import { formatDistanceToNow } from 'date-fns';
import { th } from 'date-fns/locale';

interface Message {
  id: number;
  lineMessageId: string;
  lineUserId: string;
  messageType: string;
  content: string;
  createdAt: string;
  senderName?: string;
  senderPicture?: string;
}

interface Member {
  id: number;
  lineUserId: string;
  displayName: string | null;
  pictureUrl: string | null;
}

interface Group {
  id: number;
  lineGroupId: string;
  groupName: string | null;
  groupType: string;
  pictureUrl: string | null;
  isActive: boolean;
  memberCount: number;
  totalMessages: number;
}

interface GroupChatPanelProps {
  groupId: number;
}

export function GroupChatPanel({ groupId }: GroupChatPanelProps) {
  const [messageText, setMessageText] = useState('');
  const [showMembers, setShowMembers] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch group details
  const { data: group, isLoading: groupLoading } = useQuery<Group>({
    queryKey: ['group', groupId],
    queryFn: async () => {
      console.log('Fetching group detail for ID:', groupId);
      const res = await fetch(`/api/inbox/groups/${groupId}`);
      console.log('Group detail response status:', res.status);
      const data = await res.json();
      console.log('Group detail response data:', data);
      if (!res.ok) throw new Error('Failed to fetch group');
      return data.data;
    },
  });

  // Fetch messages
  const { data: messages = [], isLoading: messagesLoading, refetch: refetchMessages } = useQuery<Message[]>({
    queryKey: ['group-messages', groupId],
    queryFn: async () => {
      console.log('Fetching messages for group ID:', groupId);
      const res = await fetch(`/api/inbox/groups/${groupId}/messages`);
      console.log('Messages response status:', res.status);
      const data = await res.json();
      console.log('Messages response data:', data);
      if (!res.ok) throw new Error('Failed to fetch messages');
      return data.data || [];
    },
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  });

  // Fetch members
  const { data: members = [], isLoading: membersLoading } = useQuery<Member[]>({
    queryKey: ['group-members', groupId],
    queryFn: async () => {
      console.log('Fetching members for group ID:', groupId);
      const res = await fetch(`/api/inbox/groups/${groupId}/members`);
      console.log('Members response status:', res.status);
      const data = await res.json();
      console.log('Members response data:', data);
      if (!res.ok) throw new Error('Failed to fetch members');
      return data.data || [];
    },
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (text: string) => {
      const result = await sendGroupMessage(groupId, text);
      if (!result.success) {
        throw new Error(result.error || 'Failed to send message');
      }
      return result;
    },
    onSuccess: () => {
      toast({
        title: 'ส่งข้อความสำเร็จ',
        description: 'ข้อความถูกส่งไปยังกลุ่มแล้ว',
      });
      setMessageText('');
      // Refresh messages
      setTimeout(() => refetchMessages(), 1000);
    },
    onError: (error: Error) => {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Leave group mutation
  const leaveGroupMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/inbox/groups/${groupId}/leave`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to leave group');
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: 'ออกจากกลุ่มแล้ว',
        description: 'บอทออกจากกลุ่มเรียบร้อยแล้ว',
      });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['group', groupId] });
    },
    onError: (error: Error) => {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Get member info by LINE user ID
  const getMemberInfo = (lineUserId: string) => {
    return members.find((m) => m.lineUserId === lineUserId);
  };

  const handleSendMessage = () => {
    if (!messageText.trim() || sendMessageMutation.isPending) return;
    sendMessageMutation.mutate(messageText.trim());
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleLeaveGroup = () => {
    if (
      !confirm(
        `ต้องการให้บอทออกจากกลุ่ม "${group?.groupName}" หรือไม่?\n\nหมายเหตุ: บอทจะไม่สามารถกลับเข้ากลุ่มได้เอง ต้องให้สมาชิกเชิญใหม่`
      )
    ) {
      return;
    }
    leaveGroupMutation.mutate();
  };

  const handleSyncMembers = async () => {
    try {
      console.log('=== SYNC MEMBERS FROM CHAT PANEL ===');
      console.log('Group ID:', groupId);
      
      // ใช้ Server Action แทน API route
      const result = await syncGroupMembers(groupId);
      
      console.log('Sync result:', result);
      
      if (result.success) {
        toast({
          title: 'ซิงค์สมาชิกสำเร็จ',
          description: result.message || `อัพเดทข้อมูลสมาชิกแล้ว (${result.data?.syncedCount || 0} คน)`,
        });
        queryClient.invalidateQueries({ queryKey: ['group-members', groupId] });
        queryClient.invalidateQueries({ queryKey: ['group', groupId] });
      } else {
        throw new Error(result.error || 'Failed to sync members');
      }
    } catch (error) {
      console.error('Sync members error:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: error instanceof Error ? error.message : 'ไม่สามารถซิงค์สมาชิกได้',
        variant: 'destructive',
      });
    }
  };

  if (groupLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>ไม่พบข้อมูลกลุ่ม</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div className="border-b p-4 bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {group.pictureUrl ? (
              <img
                src={group.pictureUrl}
                alt={group.groupName || 'Group'}
                className="w-10 h-10 rounded-full"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <Users className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            <div>
              <h2 className="text-lg font-semibold">{group.groupName || 'Unknown Group'}</h2>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{group.memberCount} สมาชิก</span>
                <span>•</span>
                <span>{group.totalMessages} ข้อความ</span>
                <Badge variant={group.isActive ? 'default' : 'secondary'} className="text-xs">
                  {group.isActive ? 'Active' : 'Left'}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowMembers(!showMembers)}
              title="ดูสมาชิก"
            >
              <Users className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetchMessages()}
              title="รีเฟรช"
            >
              <RefreshCw className="h-5 w-5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleSyncMembers}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  ซิงค์สมาชิก
                </DropdownMenuItem>
                {group.isActive && (
                  <DropdownMenuItem onClick={handleLeaveGroup} className="text-destructive">
                    <LogOut className="h-4 w-4 mr-2" />
                    ออกจากกลุ่ม
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Messages Area */}
        <div className="flex-1 flex flex-col">
          <ScrollArea className="flex-1 p-4">
            {messagesLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>ยังไม่มีข้อความในกลุ่มนี้</p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg) => {
                  const member = getMemberInfo(msg.lineUserId);
                  const isSystem = msg.messageType === 'system';

                  if (isSystem) {
                    return (
                      <div key={msg.id} className="text-center">
                        <Badge variant="secondary" className="text-xs">
                          {msg.content}
                        </Badge>
                      </div>
                    );
                  }

                  return (
                    <div key={msg.id} className="flex gap-3">
                      {/* Avatar */}
                      {msg.senderPicture || member?.pictureUrl ? (
                        <img
                          src={msg.senderPicture || member?.pictureUrl || ''}
                          alt={msg.senderName || member?.displayName || 'User'}
                          className="w-10 h-10 rounded-full flex-shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-medium text-muted-foreground">
                            {(msg.senderName || member?.displayName || '?').charAt(0)}
                          </span>
                        </div>
                      )}

                      {/* Message Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="font-medium text-sm">
                            {msg.senderName || member?.displayName || 'Unknown User'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(msg.createdAt), {
                              addSuffix: true,
                              locale: th,
                            })}
                          </span>
                        </div>

                        <div className="bg-muted rounded-lg p-3">
                          {msg.messageType === 'text' ? (
                            <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                          ) : msg.messageType === 'image' ? (
                            <div>
                              <Badge variant="outline" className="text-xs mb-2">
                                <ImageIcon className="h-3 w-3 mr-1" />
                                รูปภาพ
                              </Badge>
                              <p className="text-xs text-muted-foreground">{msg.content}</p>
                            </div>
                          ) : (
                            <div>
                              <Badge variant="outline" className="text-xs mb-2">
                                {msg.messageType}
                              </Badge>
                              <p className="text-xs text-muted-foreground">{msg.content}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>

          {/* Message Input */}
          {group.isActive && (
            <div className="border-t p-4 bg-card">
              <div className="flex gap-2">
                <Button variant="ghost" size="icon" disabled>
                  <Paperclip className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="icon" disabled>
                  <ImageIcon className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="icon" disabled>
                  <Smile className="h-5 w-5" />
                </Button>

                <Input
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="พิมพ์ข้อความ..."
                  className="flex-1"
                  disabled={sendMessageMutation.isPending}
                />

                <Button
                  onClick={handleSendMessage}
                  disabled={sendMessageMutation.isPending || !messageText.trim()}
                >
                  <Send className="h-4 w-4 mr-2" />
                  {sendMessageMutation.isPending ? 'กำลังส่ง...' : 'ส่ง'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                กด Enter เพื่อส่งข้อความ, Shift+Enter เพื่อขึ้นบรรทัดใหม่
              </p>
            </div>
          )}
        </div>

        {/* Members Sidebar */}
        {showMembers && (
          <div className="w-64 border-l bg-card">
            <div className="p-4 border-b">
              <h3 className="font-semibold">สมาชิก ({members.length})</h3>
            </div>
            <ScrollArea className="h-[calc(100%-4rem)]">
              {membersLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                </div>
              ) : (
                <div className="divide-y">
                  {members.map((member) => (
                    <div key={member.id} className="p-3 flex items-center gap-3">
                      {member.pictureUrl ? (
                        <img
                          src={member.pictureUrl}
                          alt={member.displayName || 'User'}
                          className="w-8 h-8 rounded-full"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                          <span className="text-xs font-medium text-muted-foreground">
                            {member.displayName?.charAt(0) || '?'}
                          </span>
                        </div>
                      )}
                      <span className="text-sm truncate">{member.displayName || 'Unknown'}</span>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
}
