"use client"

import { useEffect, useCallback } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useInboxStore, type ConversationFilters } from '@/stores/inbox'

/**
 * Hook to sync inbox filters with URL search parameters
 * This enables:
 * - Filter persistence across page reloads
 * - Shareable filtered views via URL
 * - Browser back/forward navigation with filters
 */
export function useFilterSync() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const { filters, setAllFilters } = useInboxStore()

  // Parse filters from URL on mount
  useEffect(() => {
    const urlFilters: ConversationFilters = {}

    const status = searchParams.get('status')
    if (status && ['all', 'active', 'pending', 'resolved'].includes(status)) {
      urlFilters.status = status as ConversationFilters['status']
    }

    const search = searchParams.get('search')
    if (search) {
      urlFilters.search = search
    }

    const tagIds = searchParams.get('tagIds')
    if (tagIds) {
      urlFilters.tagIds = tagIds.split(',').filter(Boolean)
    }

    const assignedTo = searchParams.get('assignedTo')
    if (assignedTo) {
      urlFilters.assignedTo = assignedTo
    }

    const assignedToIds = searchParams.get('assignedToIds')
    if (assignedToIds) {
      urlFilters.assignedToIds = assignedToIds.split(',').filter(Boolean)
    }

    const unreadOnly = searchParams.get('unreadOnly')
    if (unreadOnly === 'true') {
      urlFilters.unreadOnly = true
    }

    const startDate = searchParams.get('startDate')
    if (startDate) {
      urlFilters.startDate = startDate
    }

    const endDate = searchParams.get('endDate')
    if (endDate) {
      urlFilters.endDate = endDate
    }

    // Only update if URL has filters
    if (Object.keys(urlFilters).length > 0) {
      setAllFilters({
        status: 'all',
        ...urlFilters,
      })
    }
  }, [searchParams, setAllFilters])

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams()

    if (filters.status && filters.status !== 'all') {
      params.set('status', filters.status)
    }

    if (filters.search) {
      params.set('search', filters.search)
    }

    if (filters.tagIds && filters.tagIds.length > 0) {
      params.set('tagIds', filters.tagIds.join(','))
    } else if (filters.tagId) {
      params.set('tagIds', filters.tagId)
    }

    if (filters.assignedToIds && filters.assignedToIds.length > 0) {
      params.set('assignedToIds', filters.assignedToIds.join(','))
    } else if (filters.assignedTo) {
      params.set('assignedTo', filters.assignedTo)
    }

    if (filters.unreadOnly) {
      params.set('unreadOnly', 'true')
    }

    if (filters.startDate) {
      params.set('startDate', filters.startDate)
    }

    if (filters.endDate) {
      params.set('endDate', filters.endDate)
    }

    const newUrl = params.toString()
      ? `${pathname}?${params.toString()}`
      : pathname

    // Only update if URL changed
    const currentUrl = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`
    if (newUrl !== currentUrl) {
      router.replace(newUrl, { scroll: false })
    }
  }, [filters, pathname, router, searchParams])

  return {
    filters,
    hasActiveFilters: Object.keys(filters).some(
      (key) => {
        const value = filters[key as keyof ConversationFilters]
        if (key === 'status') return value !== 'all'
        if (Array.isArray(value)) return value.length > 0
        return !!value
      }
    ),
  }
}
