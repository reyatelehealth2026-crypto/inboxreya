/**
 * Performance Monitoring Utilities
 * 
 * Provides utilities for measuring and optimizing performance metrics
 * including Time to First Byte (TTFB), conversation list load time,
 * and message load time.
 */

export interface PerformanceMetrics {
  ttfb?: number
  fcp?: number
  lcp?: number
  fid?: number
  cls?: number
  conversationListLoadTime?: number
  messageLoadTime?: number
}

/**
 * Measure Time to First Byte (TTFB)
 */
export function measureTTFB(): number | null {
  if (typeof window === 'undefined') return null

  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
  if (!navigation) return null

  return navigation.responseStart - navigation.requestStart
}

/**
 * Measure First Contentful Paint (FCP)
 */
export function measureFCP(): Promise<number | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(null)
      return
    }

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'first-contentful-paint') {
          observer.disconnect()
          resolve(entry.startTime)
          return
        }
      }
    })

    try {
      observer.observe({ entryTypes: ['paint'] })
    } catch (e) {
      resolve(null)
    }
  })
}

/**
 * Measure Largest Contentful Paint (LCP)
 */
export function measureLCP(): Promise<number | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(null)
      return
    }

    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      const lastEntry = entries[entries.length - 1] as PerformanceEntry
      observer.disconnect()
      resolve(lastEntry.startTime)
    })

    try {
      observer.observe({ entryTypes: ['largest-contentful-paint'] })
    } catch (e) {
      resolve(null)
    }
  })
}

/**
 * Measure Cumulative Layout Shift (CLS)
 */
export function measureCLS(): Promise<number | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(null)
      return
    }

    let clsValue = 0
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!(entry as any).hadRecentInput) {
          clsValue += (entry as any).value
        }
      }
    })

    try {
      observer.observe({ entryTypes: ['layout-shift'] })
      
      // Disconnect after 5 seconds
      setTimeout(() => {
        observer.disconnect()
        resolve(clsValue)
      }, 5000)
    } catch (e) {
      resolve(null)
    }
  })
}

/**
 * Measure custom timing (e.g., conversation list load time)
 */
export function measureCustomTiming(name: string, startMark: string, endMark: string): number | null {
  if (typeof window === 'undefined') return null

  try {
    performance.measure(name, startMark, endMark)
    const measure = performance.getEntriesByName(name)[0]
    return measure ? measure.duration : null
  } catch (e) {
    console.warn(`Failed to measure ${name}:`, e)
    return null
  }
}

/**
 * Mark a performance timing point
 */
export function markPerformance(name: string): void {
  if (typeof window === 'undefined') return

  try {
    performance.mark(name)
  } catch (e) {
    console.warn(`Failed to mark ${name}:`, e)
  }
}

/**
 * Clear performance marks and measures
 */
export function clearPerformanceMarks(name?: string): void {
  if (typeof window === 'undefined') return

  try {
    if (name) {
      performance.clearMarks(name)
      performance.clearMeasures(name)
    } else {
      performance.clearMarks()
      performance.clearMeasures()
    }
  } catch (e) {
    console.warn('Failed to clear performance marks:', e)
  }
}

/**
 * Get all performance metrics
 */
export async function getAllPerformanceMetrics(): Promise<PerformanceMetrics> {
  const metrics: PerformanceMetrics = {}

  metrics.ttfb = measureTTFB() || undefined
  metrics.fcp = (await measureFCP()) || undefined
  metrics.lcp = (await measureLCP()) || undefined
  metrics.cls = (await measureCLS()) || undefined

  // Custom metrics
  const conversationListTime = measureCustomTiming(
    'conversation-list-load',
    'conversation-list-start',
    'conversation-list-end'
  )
  if (conversationListTime) {
    metrics.conversationListLoadTime = conversationListTime
  }

  const messageLoadTime = measureCustomTiming(
    'message-load',
    'message-load-start',
    'message-load-end'
  )
  if (messageLoadTime) {
    metrics.messageLoadTime = messageLoadTime
  }

  return metrics
}

/**
 * Log performance metrics to console (development only)
 */
export function logPerformanceMetrics(metrics: PerformanceMetrics): void {
  if (process.env.NODE_ENV !== 'development') return

  console.group('📊 Performance Metrics')
  
  if (metrics.ttfb !== undefined) {
    const ttfbStatus = metrics.ttfb < 600 ? '✅' : metrics.ttfb < 1000 ? '⚠️' : '❌'
    console.log(`${ttfbStatus} TTFB: ${metrics.ttfb.toFixed(2)}ms (target: <600ms)`)
  }

  if (metrics.fcp !== undefined) {
    const fcpStatus = metrics.fcp < 1800 ? '✅' : metrics.fcp < 3000 ? '⚠️' : '❌'
    console.log(`${fcpStatus} FCP: ${metrics.fcp.toFixed(2)}ms (target: <1800ms)`)
  }

  if (metrics.lcp !== undefined) {
    const lcpStatus = metrics.lcp < 2500 ? '✅' : metrics.lcp < 4000 ? '⚠️' : '❌'
    console.log(`${lcpStatus} LCP: ${metrics.lcp.toFixed(2)}ms (target: <2500ms)`)
  }

  if (metrics.cls !== undefined) {
    const clsStatus = metrics.cls < 0.1 ? '✅' : metrics.cls < 0.25 ? '⚠️' : '❌'
    console.log(`${clsStatus} CLS: ${metrics.cls.toFixed(3)} (target: <0.1)`)
  }

  if (metrics.conversationListLoadTime !== undefined) {
    const listStatus = metrics.conversationListLoadTime < 2000 ? '✅' : '❌'
    console.log(`${listStatus} Conversation List Load: ${metrics.conversationListLoadTime.toFixed(2)}ms (target: <2000ms)`)
  }

  if (metrics.messageLoadTime !== undefined) {
    const msgStatus = metrics.messageLoadTime < 1000 ? '✅' : '❌'
    console.log(`${msgStatus} Message Load: ${metrics.messageLoadTime.toFixed(2)}ms (target: <1000ms)`)
  }

  console.groupEnd()
}

/**
 * Send performance metrics to analytics
 */
export function sendPerformanceMetrics(metrics: PerformanceMetrics): void {
  // Implement analytics integration (e.g., Google Analytics, Sentry)
  if (process.env.NODE_ENV === 'production') {
    // Example: Send to analytics service
    if ((window as any).gtag) {
      (window as any).gtag('event', 'performance_metrics', {
        'ttfb': metrics.ttfb,
        'fcp': metrics.fcp,
        'lcp': metrics.lcp,
        'cls': metrics.cls,
        'conversation_list_load_time': metrics.conversationListLoadTime,
        'message_load_time': metrics.messageLoadTime
      });
    }
    
    // Also log to internal API if available
    fetch('/api/analytics/performance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metrics)
    }).catch(() => { /* silent fail */ });
  }
}

/**
 * Hook to measure and log performance metrics
 */
export function usePerformanceMonitoring() {
  if (typeof window === 'undefined') return

  // Measure metrics after page load
  if (document.readyState === 'complete') {
    setTimeout(async () => {
      const metrics = await getAllPerformanceMetrics()
      logPerformanceMetrics(metrics)
      sendPerformanceMetrics(metrics)
    }, 1000)
  } else {
    window.addEventListener('load', async () => {
      setTimeout(async () => {
        const metrics = await getAllPerformanceMetrics()
        logPerformanceMetrics(metrics)
        sendPerformanceMetrics(metrics)
      }, 1000)
    })
  }
}
