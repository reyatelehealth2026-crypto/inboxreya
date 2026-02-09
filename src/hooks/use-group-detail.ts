/**
 * Custom hook for managing single group details
 */

import { useState, useEffect, useCallback } from 'react';
import { LineGroup, LineGroupMember, LineGroupMessage } from '@/types/group';

interface UseGroupDetailResult {
  group: LineGroup | null;
  members: LineGroupMember[];
  messages: LineGroupMessage[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  loadMoreMessages: () => Promise<void>;
  hasMoreMessages: boolean;
}

export function useGroupDetail(groupId: number): UseGroupDetailResult {
  const [group, setGroup] = useState<LineGroup | null>(null);
  const [members, setMembers] = useState<LineGroupMember[]>([]);
  const [messages, setMessages] = useState<LineGroupMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);

  const fetchGroupDetail = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch group info
      const groupResponse = await fetch(`/api/inbox/groups/${groupId}`);
      const groupData = await groupResponse.json();

      if (!groupData.success) {
        throw new Error(groupData.error || 'Failed to fetch group');
      }

      setGroup(groupData.data.group);

      // Fetch members
      const membersResponse = await fetch(`/api/inbox/groups/${groupId}/members`);
      const membersData = await membersResponse.json();

      if (membersData.success) {
        setMembers(membersData.data.members || []);
      }

      // Fetch messages
      const messagesResponse = await fetch(
        `/api/inbox/groups/${groupId}/messages?limit=50&offset=0`
      );
      const messagesData = await messagesResponse.json();

      if (messagesData.success) {
        const newMessages = messagesData.data.messages || [];
        setMessages(newMessages);
        setHasMoreMessages(newMessages.length === 50);
        setOffset(50);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching group detail:', err);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  const loadMoreMessages = useCallback(async () => {
    if (!hasMoreMessages) return;

    try {
      const response = await fetch(
        `/api/inbox/groups/${groupId}/messages?limit=50&offset=${offset}`
      );
      const data = await response.json();

      if (data.success) {
        const newMessages = data.data.messages || [];
        setMessages((prev) => [...prev, ...newMessages]);
        setHasMoreMessages(newMessages.length === 50);
        setOffset((prev) => prev + 50);
      }
    } catch (err) {
      console.error('Error loading more messages:', err);
    }
  }, [groupId, offset, hasMoreMessages]);

  useEffect(() => {
    if (groupId) {
      fetchGroupDetail();
    }
  }, [groupId, fetchGroupDetail]);

  return {
    group,
    members,
    messages,
    loading,
    error,
    refetch: fetchGroupDetail,
    loadMoreMessages,
    hasMoreMessages,
  };
}
