/**
 * Group Chat Component
 * Chat interface for LINE group conversations
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Send, Image as ImageIcon, Paperclip, Smile } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { sendGroupMessage } from '@/actions/send-group-message';

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

interface GroupChatProps {
  groupId: number;
  groupName: string;
  messages: Message[];
  members: Member[];
  onRefresh: () => void;
}

export function GroupChat({ groupId, groupName, messages, members, onRefresh }: GroupChatProps) {
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Get member info by LINE user ID
  const getMemberInfo = (lineUserId: string) => {
    return members.find((m) => m.lineUserId === lineUserId);
  };

  const handleSendMessage = async () => {
    if (!messageText.trim()) return;

    setSending(true);
    try {
      const result = await sendGroupMessage(groupId, messageText.trim());

      if (result.success) {
        toast({
          title: 'ส่งข้อความสำเร็จ',
          description: 'ข้อความถูกส่งไปยังกลุ่มแล้ว',
        });
        setMessageText('');
        // Refresh messages after sending
        setTimeout(() => onRefresh(), 1000);
      } else {
        toast({
          title: 'เกิดข้อผิดพลาด',
          description: result.error || 'ไม่สามารถส่งข้อความได้',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Send message error:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div className="border-b p-4 bg-white">
        <h2 className="text-lg font-semibold">{groupName}</h2>
        <p className="text-sm text-gray-500">{members.length} สมาชิก</p>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            ยังไม่มีข้อความในกลุ่มนี้
          </div>
        ) : (
          messages.map((msg) => {
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
                {member?.pictureUrl ? (
                  <img
                    src={member.pictureUrl}
                    alt={member.displayName || 'User'}
                    className="w-10 h-10 rounded-full flex-shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-medium text-gray-600">
                      {member?.displayName?.charAt(0) || '?'}
                    </span>
                  </div>
                )}

                {/* Message Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="font-medium text-sm">
                      {member?.displayName || 'Unknown User'}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(msg.createdAt).toLocaleString('th-TH', {
                        timeZone: 'Asia/Bangkok',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <div className="bg-white rounded-lg p-3 shadow-sm">
                    {msg.messageType === 'text' ? (
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                    ) : msg.messageType === 'image' ? (
                      <div>
                        <Badge variant="outline" className="text-xs mb-2">
                          <ImageIcon className="h-3 w-3 mr-1" />
                          รูปภาพ
                        </Badge>
                        <p className="text-xs text-gray-500">{msg.content}</p>
                      </div>
                    ) : (
                      <div>
                        <Badge variant="outline" className="text-xs mb-2">
                          {msg.messageType}
                        </Badge>
                        <p className="text-xs text-gray-500">{msg.content}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="border-t p-4 bg-white">
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
            disabled={sending}
          />

          <Button onClick={handleSendMessage} disabled={sending || !messageText.trim()}>
            <Send className="h-4 w-4 mr-2" />
            {sending ? 'กำลังส่ง...' : 'ส่ง'}
          </Button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          กด Enter เพื่อส่งข้อความ, Shift+Enter เพื่อขึ้นบรรทัดใหม่
        </p>
      </div>
    </div>
  );
}
