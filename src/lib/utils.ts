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

export function formatMessageTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  
  // CRITICAL: Database stores dates in Bangkok time (+07:00)
  // The date string from API includes timezone: "2025-01-29T05:17:00.000+07:00"
  // Parse the date and extract Bangkok time components
  
  // Get current time in Bangkok (UTC+7)
  const nowUTC = new Date()
  const bangkokNow = new Date(nowUTC.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }))
  
  // Parse message date in Bangkok timezone
  const messageDate = new Date(d)
  const messageBangkok = new Date(messageDate.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }))
  
  // Compare dates (year, month, day only)
  const nowYear = bangkokNow.getFullYear()
  const nowMonth = bangkokNow.getMonth()
  const nowDay = bangkokNow.getDate()
  
  const msgYear = messageBangkok.getFullYear()
  const msgMonth = messageBangkok.getMonth()
  const msgDay = messageBangkok.getDate()
  
  const isSameDay = nowYear === msgYear && nowMonth === msgMonth && nowDay === msgDay
  
  if (isSameDay) {
    return format(messageBangkok, 'HH:mm')
  }
  
  // Check if yesterday
  const yesterday = new Date(bangkokNow)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterdayDay = yesterday.getFullYear() === msgYear && 
                         yesterday.getMonth() === msgMonth && 
                         yesterday.getDate() === msgDay
  
  if (isYesterdayDay) {
    return `เมื่อวาน ${format(messageBangkok, 'HH:mm')}`
  }

  return format(messageBangkok, 'd MMM HH:mm', { locale: th })
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
