/**
 * Groups Page Client Component
 * Inbox-style layout for LINE groups
 */

'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Menu, ArrowLeft } from 'lucide-react';
import { GroupConversationList } from '@/components/groups/GroupConversationList';
import { GroupChatPanel } from '@/components/groups/GroupChatPanel';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function GroupsPageClient() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Handle mobile view changes when group is selected
  useEffect(() => {
    if (isMobile && selectedGroupId) {
      setMobileView('chat');
    }
  }, [isMobile, selectedGroupId]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
    }
  }, [status, router]);

  const handleSelectGroup = (groupId: number) => {
    setSelectedGroupId(groupId);
  };

  const handleBackToList = () => {
    setMobileView('list');
    setSelectedGroupId(null);
  };

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  // Mobile layout
  if (isMobile) {
    return (
      <div className="flex flex-col h-screen overflow-hidden bg-background">
        {/* Mobile Header */}
        <div className="flex items-center justify-between p-3 border-b bg-card">
          {mobileView === 'list' ? (
            <>
              <h1 className="font-semibold text-lg">กลุ่ม LINE</h1>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="icon" onClick={handleBackToList}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <span className="font-medium">แชทกลุ่ม</span>
              <div className="w-10" />
            </>
          )}
        </div>

        {/* Mobile Content */}
        <div className="flex-1 overflow-hidden h-full">
          {mobileView === 'list' && (
            <GroupConversationList
              selectedGroupId={selectedGroupId}
              onSelectGroup={handleSelectGroup}
            />
          )}
          {mobileView === 'chat' && selectedGroupId && (
            <GroupChatPanel groupId={selectedGroupId} />
          )}
        </div>
      </div>
    );
  }

  // Desktop layout
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Group List */}
      <div className="flex-shrink-0 w-72 border-r">
        <GroupConversationList
          selectedGroupId={selectedGroupId}
          onSelectGroup={handleSelectGroup}
        />
      </div>

      {/* Chat Panel */}
      <div className="flex-1 min-w-0">
        {selectedGroupId ? (
          <GroupChatPanel groupId={selectedGroupId} />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <Menu className="h-12 w-12 mx-auto mb-2 opacity-20" />
              <p>เลือกกลุ่มเพื่อเริ่มแชท</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
