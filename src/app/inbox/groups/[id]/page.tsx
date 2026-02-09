/**
 * Group Detail Page
 * Detailed view of a single LINE group
 */

import { Metadata } from 'next';
import { GroupDetail } from '@/components/groups/GroupDetail';
import { InboxLayout } from '@/components/layout/InboxLayout';

export const metadata: Metadata = {
  title: 'รายละเอียดกลุ่ม | Inbox',
  description: 'รายละเอียดกลุ่ม LINE',
};

interface GroupDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function GroupDetailPage({ params }: GroupDetailPageProps) {
  const { id } = await params;
  const groupId = parseInt(id, 10);

  if (isNaN(groupId)) {
    return (
      <InboxLayout>
        <div className="container mx-auto py-6">
          <div className="text-center text-red-600">
            <p>รหัสกลุ่มไม่ถูกต้อง</p>
          </div>
        </div>
      </InboxLayout>
    );
  }

  return (
    <InboxLayout>
      <div className="container mx-auto py-6">
        <GroupDetail groupId={groupId} />
      </div>
    </InboxLayout>
  );
}
