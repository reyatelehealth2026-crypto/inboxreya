/**
 * LINE Group Chat Types
 * Based on LINE Messaging API Group Chat endpoints
 */

export interface LineGroup {
  id: number;
  lineAccountId: number;
  groupId: string; // LINE group ID
  groupType: 'group' | 'room';
  groupName: string | null;
  pictureUrl: string | null;
  memberCount: number;
  invitedBy: string | null;
  invitedByName: string | null;
  isActive: boolean;
  joinedAt: Date;
  leftAt: Date | null;
  lastActivityAt: Date | null;
  totalMessages: number;
  settings: Record<string, any> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LineGroupMember {
  id: number;
  groupId: number;
  lineUserId: string;
  displayName: string | null;
  pictureUrl: string | null;
  isActive: boolean;
  joinedAt: Date;
  leftAt: Date | null;
  lastMessageAt: Date | null;
  totalMessages: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface LineGroupMessage {
  id: number;
  groupId: number;
  lineUserId: string;
  messageType: string;
  content: string;
  messageId: string | null;
  replyToken: string | null;
  metadata: Record<string, any> | null;
  createdAt: Date;
}

export interface GroupSummary {
  groupId: string;
  groupName: string;
  pictureUrl?: string;
}

export interface GroupMemberCount {
  count: number;
}

export interface GroupMemberIds {
  memberIds: string[];
  next?: string; // Continuation token
}

export interface GroupMemberProfile {
  displayName: string;
  userId: string;
  pictureUrl?: string;
}

export interface GroupStats {
  total: number;
  active: number;
  totalMembers: number;
  totalMessages: number;
}

export interface GroupFilters {
  lineAccountId?: number;
  isActive?: boolean;
  groupType?: 'group' | 'room';
  search?: string;
}
