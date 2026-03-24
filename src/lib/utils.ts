import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { formatDistanceToNow, format, isToday, isYesterday } from "date-fns"
import { th } from "date-fns/locale"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Note: MySQL in PHP backend is configured with timezone +07:00
 * So dates from database are already in Bangkok time, not UTC
 * We should NOT add 7 hours again
 */

export function formatTimeAgo(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'เมื่อสักครู่'
  if (diffMins < 60) return `${diffMins} นาทีที่แล้ว`
  if (diffHours < 24) return `${diffHours} ชั่วโมงที่แล้ว`
  if (diffDays === 1) return 'เมื่อวาน'
  if (diffDays < 7) return `${diffDays} วันที่แล้ว`

  return formatDistanceToNow(d, { addSuffix: true, locale: th })
}

export function formatMessageTime(date: Date | string | null | undefined): string {
  if (date == null) return '-'
  const d = typeof date === 'string' ? new Date(date) : date
  
  // Guard: if date is invalid, return fallback
  if (!(d instanceof Date) || isNaN(d.getTime())) return '-'
  
  const msgYear  = d.getUTCFullYear()
  const msgMonth = d.getUTCMonth() + 1
  const msgDay   = d.getUTCDate()
  const msgHour  = String(d.getUTCHours()).padStart(2, '0')
  const msgMin   = String(d.getUTCMinutes()).padStart(2, '0')
  const timeStr  = `${msgHour}:${msgMin}`

  const nowUtc = new Date()
  const bkkNow = new Date(nowUtc.getTime() + 7 * 3600_000)
  const nowYear = bkkNow.getUTCFullYear()
  const nowMonth = bkkNow.getUTCMonth() + 1
  const nowDay = bkkNow.getUTCDate()

  if (nowYear === msgYear && nowMonth === msgMonth && nowDay === msgDay) {
    return timeStr
  }

  const bkkYesterday = new Date(bkkNow.getTime() - 86_400_000)
  if (
    bkkYesterday.getUTCFullYear() === msgYear &&
    bkkYesterday.getUTCMonth() + 1 === msgMonth &&
    bkkYesterday.getUTCDate() === msgDay
  ) {
    return `เมื่อวาน ${timeStr}`
  }

  const localDate = new Date(msgYear, msgMonth - 1, msgDay, parseInt(msgHour), parseInt(msgMin))
  return format(localDate, 'd MMM HH:mm', { locale: th })
}

/**
 * Convert date to Bangkok timezone (GMT+7)
 * Use this for displaying dates from Next.js API
 */
export function toBangkokTime(date: Date | string): Date {
  const d = typeof date === 'string' ? new Date(date) : date
  // Convert to Bangkok timezone
  return new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }))
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const bangkokDate = toBangkokTime(d)
  return format(bangkokDate, 'd MMMM yyyy', { locale: th })
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str
  return str.slice(0, length) + '...'
}

export function getInitials(name: string): string {
  if (name === null || name === undefined) return '?'
  const safeName = String(name).trim()
  if (!safeName) return '?'
  const parts = safeName.split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0]
  const second = parts[1]?.[0]
  if (first && second) {
    return `${first}${second}`.toUpperCase()
  }
  return safeName.slice(0, 2).toUpperCase()
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15)
}

export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function getMessageTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    text: '💬',
    image: '🖼️',
    video: '🎥',
    audio: '🎵',
    file: '📎',
    location: '📍',
    sticker: '😊',
    flex: '📋',
  }
  return icons[type] || '💬'
}

/**
 * Highlights matching text in a string by splitting it into parts
 * @param text - The text to search in
 * @param query - The search query to highlight
 * @returns Array of text parts with highlight flag
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 0
  }).format(amount);
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('th-TH').format(num);
}
