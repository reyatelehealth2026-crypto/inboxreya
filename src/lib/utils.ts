import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { formatDistanceToNow, format } from "date-fns"
import { th } from "date-fns/locale"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Message timestamps from the API are RFC 3339 UTC (`...Z`). `formatMessageTime` displays them in Asia/Bangkok.
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

  // Convert to Bangkok timezone properly using Intl.DateTimeFormat
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  })
  
  const parts = formatter.formatToParts(d)
  const getPart = (p: Intl.DateTimeFormatPart[], type: string) =>
    p.find((x) => x.type === type)?.value ?? '0'

  const msgYear = parseInt(getPart(parts, 'year'))
  const msgMonth = parseInt(getPart(parts, 'month'))
  const msgDay = parseInt(getPart(parts, 'day'))
  const msgHour = getPart(parts, 'hour').padStart(2, '0')
  const msgMin = getPart(parts, 'minute').padStart(2, '0')
  const timeStr = `${msgHour}:${msgMin}`

  const nowParts = formatter.formatToParts(new Date())
  const nowYear = parseInt(getPart(nowParts, 'year'))
  const nowMonth = parseInt(getPart(nowParts, 'month'))
  const nowDay = parseInt(getPart(nowParts, 'day'))

  if (nowYear === msgYear && nowMonth === msgMonth && nowDay === msgDay) {
    return timeStr
  }

  // "Yesterday" in Asia/Bangkok (Thailand has no DST; ~24h back is sufficient)
  const yestParts = formatter.formatToParts(new Date(Date.now() - 86400000))
  const yestYear = parseInt(getPart(yestParts, 'year'))
  const yestMonth = parseInt(getPart(yestParts, 'month'))
  const yestDay = parseInt(getPart(yestParts, 'day'))

  if (yestYear === msgYear && yestMonth === msgMonth && yestDay === msgDay) {
    return `เมื่อวาน ${timeStr}`
  }

  const localDate = new Date(msgYear, msgMonth - 1, msgDay, parseInt(msgHour), parseInt(msgMin))
  return format(localDate, 'd MMM HH:mm', { locale: th })
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '-'
  return new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    calendar: 'gregory',
  }).format(d)
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
