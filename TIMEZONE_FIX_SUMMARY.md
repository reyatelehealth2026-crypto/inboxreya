# Timezone Display Fix Summary

## Problem
Messages were showing incorrect time:
- Displayed: "วันนี้ 22:15" 
- Should be: "วันนี้ 05:15" (or "เมื่อวาน" if yesterday)

## Root Cause
The `formatMessageTime()` function was using `isToday()` and `isYesterday()` from `date-fns`, which compare dates in the browser's local timezone. However, dates from the MySQL database are stored in Bangkok time (UTC+7) and when converted to JavaScript Date objects, they need proper timezone handling.

## Solution
Modified `formatMessageTime()` in `inboxreya/src/lib/utils.ts` to:
1. Convert both current time and message time to Bangkok timezone explicitly
2. Compare dates in Bangkok timezone (not browser local time)
3. Format the time correctly based on Bangkok timezone

### Code Changes

**Before:**
```typescript
export function formatMessageTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date

  if (isToday(d)) {
    return format(d, 'HH:mm')
  }

  if (isYesterday(d)) {
    return `เมื่อวาน ${format(d, 'HH:mm')}`
  }

  return format(d, 'd MMM HH:mm', { locale: th })
}
```

**After:**
```typescript
export function formatMessageTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  
  // Get current Bangkok time
  const now = new Date()
  const bangkokNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }))
  
  // Get message Bangkok time
  const bangkokMsg = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }))
  
  // Check if same day
  const isSameDay = bangkokNow.getFullYear() === bangkokMsg.getFullYear() &&
                    bangkokNow.getMonth() === bangkokMsg.getMonth() &&
                    bangkokNow.getDate() === bangkokMsg.getDate()
  
  if (isSameDay) {
    return format(bangkokMsg, 'HH:mm')
  }
  
  // Check if yesterday
  const yesterday = new Date(bangkokNow)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterdayDay = yesterday.getFullYear() === bangkokMsg.getFullYear() &&
                         yesterday.getMonth() === bangkokMsg.getMonth() &&
                         yesterday.getDate() === bangkokMsg.getDate()
  
  if (isYesterdayDay) {
    return `เมื่อวาน ${format(bangkokMsg, 'HH:mm')}`
  }

  return format(bangkokMsg, 'd MMM HH:mm', { locale: th })
}
```

## Testing
1. Refresh the page (Ctrl+R or F5)
2. Check message timestamps - they should now show correct Bangkok time
3. Messages sent today should show "HH:mm" format
4. Messages sent yesterday should show "เมื่อวาน HH:mm"
5. Older messages should show "d MMM HH:mm"

## Related Files
- `inboxreya/src/lib/utils.ts` - Fixed `formatMessageTime()` function

## Notes
- MySQL in PHP backend is configured with `SET time_zone = '+07:00'`
- Dates stored in database are already in Bangkok time
- We should NOT add 7 hours to dates from database
- The fix ensures proper timezone comparison for "today" and "yesterday" detection

