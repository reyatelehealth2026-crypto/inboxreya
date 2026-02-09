/**
 * Groups Page
 * Main page for managing LINE groups with inbox-style layout
 */

import { Metadata } from 'next';
import { GroupsPageClient } from './GroupsPageClient';

export const metadata: Metadata = {
  title: 'จัดการกลุ่ม LINE | Inbox',
  description: 'จัดการกลุ่ม LINE ที่บอทเข้าร่วม',
};

export default function GroupsPage() {
  return <GroupsPageClient />;
}
