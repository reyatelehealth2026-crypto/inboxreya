/**
 * Custom hook for managing LINE groups
 */

import { useState, useEffect, useCallback } from 'react';
import { LineGroup, GroupStats, GroupFilters } from '@/types/group';

interface UseGroupsResult {
  groups: LineGroup[];
  stats: GroupStats | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  sendMessage: (groupId: number, message: string) => Promise<boolean>;
  leaveGroup: (groupId: number) => Promise<boolean>;
}

export function useGroups(filters?: GroupFilters): UseGroupsResult {
  const [groups, setGroups] = useState<LineGroup[]>([]);
  const [stats, setStats] = useState<GroupStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGroups = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (filters?.lineAccountId) {
        params.append('lineAccountId', filters.lineAccountId.toString());
      }
      if (filters?.isActive !== undefined) {
        params.append('isActive', filters.isActive.toString());
      }
      if (filters?.groupType) {
        params.append('groupType', filters.groupType);
      }
      if (filters?.search) {
        params.append('search', filters.search);
      }

      console.log('useGroups - Fetching with params:', params.toString());
      const response = await fetch(`/api/inbox/groups?${params.toString()}`);
      
      console.log('useGroups - Response status:', response.status);
      console.log('useGroups - Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        const text = await response.text();
        console.error('useGroups - Error response body:', text);
        throw new Error(`HTTP ${response.status}: ${text.substring(0, 200)}`);
      }
      
      const data = await response.json();

      console.log('useGroups - Raw response:', data);
      console.log('useGroups - Groups array:', data.data?.groups);
      console.log('useGroups - Stats:', data.data?.stats);

      if (!data.success) {
        const errorMsg = typeof data.error === 'string' 
          ? data.error 
          : JSON.stringify(data.error);
        throw new Error(errorMsg || 'Failed to fetch groups');
      }

      setGroups(data.data.groups || []);
      setStats(data.data.stats || null);
    } catch (err) {
      const errorMessage = err instanceof Error 
        ? err.message 
        : typeof err === 'string' 
          ? err 
          : JSON.stringify(err);
      setError(errorMessage);
      console.error('Error fetching groups:', err);
      console.error('Error details:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const sendMessage = useCallback(async (groupId: number, message: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/inbox/groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'send_message',
          groupId,
          message,
        }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to send message');
      }

      return true;
    } catch (err) {
      console.error('Error sending message:', err);
      setError(err instanceof Error ? err.message : 'Failed to send message');
      return false;
    }
  }, []);

  const leaveGroup = useCallback(async (groupId: number): Promise<boolean> => {
    try {
      const response = await fetch(`/api/inbox/groups/${groupId}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to leave group');
      }

      // Refresh groups list
      await fetchGroups();
      return true;
    } catch (err) {
      console.error('Error leaving group:', err);
      setError(err instanceof Error ? err.message : 'Failed to leave group');
      return false;
    }
  }, [fetchGroups]);

  return {
    groups,
    stats,
    loading,
    error,
    refetch: fetchGroups,
    sendMessage,
    leaveGroup,
  };
}
