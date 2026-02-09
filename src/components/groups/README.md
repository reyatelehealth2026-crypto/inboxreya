# LINE Group Chat Components

React components for managing LINE group chats in the Inbox system.

## Components

### GroupsList
Main component for displaying and managing groups list.

**Features:**
- Display groups with stats
- Filter by status, type, search
- Send messages to groups
- Leave groups
- Navigate to group details

**Usage:**
```tsx
import { GroupsList } from '@/components/groups/GroupsList';

export default function GroupsPage() {
  return <GroupsList />;
}
```

### GroupDetail
Component for displaying detailed information about a single group.

**Features:**
- Display group info (name, avatar, stats)
- Show members list
- Show recent messages
- Load more messages (pagination)
- Back navigation

**Usage:**
```tsx
import { GroupDetail } from '@/components/groups/GroupDetail';

export default function GroupDetailPage({ params }) {
  return <GroupDetail groupId={params.id} />;
}
```

## Hooks

### useGroups
Hook for managing groups list with filtering and actions.

**Returns:**
- `groups`: Array of groups
- `stats`: Group statistics
- `loading`: Loading state
- `error`: Error message
- `refetch`: Function to refresh data
- `sendMessage`: Function to send message to group
- `leaveGroup`: Function to leave group

**Example:**
```tsx
import { useGroups } from '@/hooks/use-groups';

function MyComponent() {
  const { 
    groups, 
    stats, 
    loading, 
    error, 
    sendMessage, 
    leaveGroup 
  } = useGroups({
    isActive: true,
    groupType: 'group',
    search: 'pharmacy'
  });

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h2>Total Groups: {stats?.total}</h2>
      {groups.map(group => (
        <div key={group.id}>{group.groupName}</div>
      ))}
    </div>
  );
}
```

### useGroupDetail
Hook for managing single group detail with members and messages.

**Returns:**
- `group`: Group object
- `members`: Array of members
- `messages`: Array of messages
- `loading`: Loading state
- `error`: Error message
- `refetch`: Function to refresh data
- `loadMoreMessages`: Function to load more messages
- `hasMoreMessages`: Boolean indicating if more messages available

**Example:**
```tsx
import { useGroupDetail } from '@/hooks/use-group-detail';

function GroupDetailComponent({ groupId }) {
  const { 
    group, 
    members, 
    messages, 
    loading,
    loadMoreMessages,
    hasMoreMessages
  } = useGroupDetail(groupId);

  if (loading) return <div>Loading...</div>;
  if (!group) return <div>Group not found</div>;

  return (
    <div>
      <h1>{group.groupName}</h1>
      <p>Members: {members.length}</p>
      <div>
        {messages.map(msg => (
          <div key={msg.id}>{msg.content}</div>
        ))}
        {hasMoreMessages && (
          <button onClick={loadMoreMessages}>Load More</button>
        )}
      </div>
    </div>
  );
}
```

## Types

### LineGroup
```typescript
interface LineGroup {
  id: number;
  lineAccountId: number;
  groupId: string;
  groupType: 'group' | 'room';
  groupName: string | null;
  pictureUrl: string | null;
  memberCount: number;
  isActive: boolean;
  joinedAt: Date;
  leftAt: Date | null;
  totalMessages: number;
}
```

### LineGroupMember
```typescript
interface LineGroupMember {
  id: number;
  groupId: number;
  lineUserId: string;
  displayName: string | null;
  pictureUrl: string | null;
  isActive: boolean;
  totalMessages: number;
  lastMessageAt: Date | null;
}
```

### LineGroupMessage
```typescript
interface LineGroupMessage {
  id: number;
  groupId: number;
  lineUserId: string;
  messageType: string;
  content: string;
  createdAt: Date;
}
```

### GroupStats
```typescript
interface GroupStats {
  total: number;
  active: number;
  totalMembers: number;
  totalMessages: number;
}
```

### GroupFilters
```typescript
interface GroupFilters {
  lineAccountId?: number;
  isActive?: boolean;
  groupType?: 'group' | 'room';
  search?: string;
}
```

## API Routes

### GET /api/inbox/groups
Get list of groups with optional filters.

**Query Parameters:**
- `lineAccountId`: Filter by LINE account
- `isActive`: Filter by active status
- `groupType`: Filter by group type
- `search`: Search by group name

**Response:**
```json
{
  "success": true,
  "data": {
    "groups": [...],
    "stats": {
      "total": 10,
      "active": 8,
      "totalMembers": 150,
      "totalMessages": 5000
    }
  }
}
```

### POST /api/inbox/groups
Send message to group.

**Body:**
```json
{
  "action": "send_message",
  "groupId": 123,
  "message": "Hello group!"
}
```

### GET /api/inbox/groups/[id]
Get single group detail.

**Response:**
```json
{
  "success": true,
  "data": {
    "group": {...}
  }
}
```

### DELETE /api/inbox/groups/[id]
Leave group.

**Response:**
```json
{
  "success": true,
  "message": "Left group successfully"
}
```

### GET /api/inbox/groups/[id]/members
Get group members.

**Response:**
```json
{
  "success": true,
  "data": {
    "members": [...]
  }
}
```

### GET /api/inbox/groups/[id]/messages
Get group messages with pagination.

**Query Parameters:**
- `limit`: Number of messages (default: 50)
- `offset`: Offset for pagination (default: 0)

**Response:**
```json
{
  "success": true,
  "data": {
    "messages": [...]
  }
}
```

## Styling

Components use Tailwind CSS and shadcn/ui components:
- `Card` - Container component
- `Button` - Action buttons
- `Input` - Search input
- `Select` - Filter dropdowns
- `Badge` - Status badges

## Icons

Uses Lucide React icons:
- `Users` - Group icon
- `MessageSquare` - Messages icon
- `Search` - Search icon
- `Send` - Send message icon
- `LogOut` - Leave group icon
- `ArrowLeft` - Back navigation
- `User` - Member icon

## Error Handling

All components handle errors gracefully:
- Display error messages
- Provide retry functionality
- Show loading states
- Handle empty states

## Performance

- Pagination for messages (50 per page)
- Lazy loading of group details
- Optimistic UI updates
- Efficient re-renders with React hooks

## Accessibility

- Semantic HTML
- ARIA labels
- Keyboard navigation
- Screen reader support
- Focus management

## Testing

### Manual Testing Checklist
- [ ] Groups list loads correctly
- [ ] Filters work as expected
- [ ] Search functionality works
- [ ] Group detail displays correctly
- [ ] Members list shows all members
- [ ] Messages load with pagination
- [ ] Send message works
- [ ] Leave group works
- [ ] Error states display properly
- [ ] Loading states show correctly

### Edge Cases
- [ ] Empty groups list
- [ ] Group with no members
- [ ] Group with no messages
- [ ] Very long group names
- [ ] Large member lists
- [ ] Network errors
- [ ] Invalid group IDs

## Future Enhancements

1. Real-time message updates
2. Rich message support (Flex, Template)
3. File/image sharing
4. Group settings management
5. Member management
6. Group analytics
7. Export functionality
8. Bulk operations
