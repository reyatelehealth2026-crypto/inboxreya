import type { AdminUser } from '@/types'

type BadgeColor = {
  bg: string
  border: string
  text?: string
}

const DEFAULT_ASSIGNEE_COLOR: BadgeColor = {
  bg: '#0C665D',
  border: '#0A5550',
  text: '#FFFFFF',
}

// ตั้งค่าสีรายคน (แก้ไขได้ตามต้องการ)
// ใช้ id หรือ username เป็นคีย์
const ASSIGNEE_COLORS_BY_ID: Record<string, BadgeColor> = {
  // ตัวอย่าง:
  // '1': { bg: '#7C3AED', border: '#6D28D9', text: '#FFFFFF' },
}

const ASSIGNEE_COLORS_BY_USERNAME: Record<string, BadgeColor> = {
  // ตัวอย่าง:
  // 'admin': { bg: '#0EA5E9', border: '#0284C7', text: '#FFFFFF' },
}

export function resolveAssigneeBadgeColor(assignee?: AdminUser | null): BadgeColor {
  if (!assignee) return DEFAULT_ASSIGNEE_COLOR
  const byId = ASSIGNEE_COLORS_BY_ID[assignee.id]
  if (byId) return byId
  const username = (assignee.username || '').toLowerCase()
  const byUsername = ASSIGNEE_COLORS_BY_USERNAME[username]
  if (byUsername) return byUsername
  return DEFAULT_ASSIGNEE_COLOR
}
