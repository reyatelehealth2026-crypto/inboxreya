'use client'

import { useReportWebVitals } from 'next/web-vitals'

export function WebVitals() {
  useReportWebVitals((metric) => {
    // In a real app, you would send this to an analytics endpoint
    // For now, we log it to the console in development
    // and could potentially send it to a custom logging API
    if (process.env.NODE_ENV === 'development') {
      console.log('Web Vital:', metric)
    }

    // Example of sending to a logging endpoint
    /*
    const body = JSON.stringify(metric)
    const url = '/api/vitals'

    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, body)
    } else {
      fetch(url, { body, method: 'POST', keepalive: true })
    }
    */
  })

  return null
}
