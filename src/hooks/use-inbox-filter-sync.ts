"use client"

import { useEffect, useMemo, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { ConversationFilters } from '@/stores/inbox'
import { useInboxStore } from '@/stores/inbox'
import { useSettingsStore } from '@/stores/settings'
import { useSession } from 'next-auth/react'

const DEFAULT_FILTERS: ConversationFilters = {
  status: 'all',
  tagId: undefined,
  tagIds: undefined,
  assignedTo: undefined,
  assignedToIds: undefined,
  search: '',
  unreadOnly: false,
  startDate: undefined,
  endDate: undefined,
}

function parseFiltersFromParams(params: URLSearchParams): ConversationFilters {
  const statusParam = params.get('status') || 'all'
  const status =
    statusParam === 'active' || statusParam === 'pending' || statusParam === 'resolved'
      ? statusParam
      : 'all'

  const tagIds = params
    .get('tagIds')
    ?.split(',')
    .map((id) => id.trim())
    .filter(Boolean)

  const assignedToIds = params
    .get('assignedToIds')
    ?.split(',')
    .map((id) => id.trim())
    .filter(Boolean)

  const searchParam = params.get('search')

  return {
    status,
    search: searchParam && searchParam.trim() !== '' ? searchParam.trim() : undefined,
    tagId: params.get('tagId') || undefined,
    tagIds: tagIds && tagIds.length > 0 ? tagIds : undefined,
    assignedTo: params.get('assignedTo') || undefined,
    assignedToIds: assignedToIds && assignedToIds.length > 0 ? assignedToIds : undefined,
    unreadOnly: params.get('unreadOnly') === 'true' || params.get('unreadOnly') === '1',
    startDate: params.get('startDate') || undefined,
    endDate: params.get('endDate') || undefined,
  }
}

function buildParamsFromFilters(filters: ConversationFilters) {
  const params = new URLSearchParams()

  if (filters.status && filters.status !== 'all') {
    params.set('status', filters.status)
  }

  const searchValue = filters.search?.trim()
  if (searchValue && searchValue !== '') {
    params.set('search', searchValue)
  }

  if (filters.tagId) {
    params.set('tagId', filters.tagId)
  }

  if (filters.tagIds && filters.tagIds.length > 0) {
    params.set('tagIds', filters.tagIds.join(','))
  }

  if (filters.assignedTo) {
    params.set('assignedTo', filters.assignedTo)
  }

  if (filters.assignedToIds && filters.assignedToIds.length > 0) {
    params.set('assignedToIds', filters.assignedToIds.join(','))
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

  return params.toString()
}

function isDefaultFilters(filters: ConversationFilters): boolean {
  const searchValue = filters.search?.trim()
  const isSearchEmpty = !searchValue || searchValue === ''

  return (
    (!filters.status || filters.status === 'all') &&
    !filters.tagId &&
    (!filters.tagIds || filters.tagIds.length === 0) &&
    !filters.assignedTo &&
    (!filters.assignedToIds || filters.assignedToIds.length === 0) &&
    isSearchEmpty &&
    !filters.unreadOnly &&
    !filters.startDate &&
    !filters.endDate
  )
}

function areFiltersEqual(a: ConversationFilters, b: ConversationFilters) {
  const aSearch = a.search?.trim() || ''
  const bSearch = b.search?.trim() || ''

  return (
    (a.status || 'all') === (b.status || 'all') &&
    aSearch === bSearch &&
    (a.tagId || '') === (b.tagId || '') &&
    JSON.stringify(a.tagIds ?? []) === JSON.stringify(b.tagIds ?? []) &&
    (a.assignedTo || '') === (b.assignedTo || '') &&
    JSON.stringify(a.assignedToIds ?? []) === JSON.stringify(b.assignedToIds ?? []) &&
    !!a.unreadOnly === !!b.unreadOnly &&
    (a.startDate || '') === (b.startDate || '') &&
    (a.endDate || '') === (b.endDate || '')
  )
}

export function useInboxFilterSync() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const filters = useInboxStore((state) => state.filters)
  const setAllFilters = useInboxStore((state) => state.setAllFilters)
  const { defaultFilter, _hasHydrated } = useSettingsStore()
  const { data: session } = useSession()

  // Track if we're currently updating to prevent infinite loops
  const isUpdatingRef = useRef(false)
  // Track the last URL we set to prevent re-syncing our own changes
  const lastSetUrlRef = useRef('')
  // Track if we have applied the default filter from settings
  const hasAppliedDefaultRef = useRef(false)

  const parsedFilters = useMemo(() => {
    if (!searchParams) return DEFAULT_FILTERS
    return parseFiltersFromParams(searchParams)
  }, [searchParams])

  // Apply default filter from settings on FIRST mount only (after hydration)
  useEffect(() => {
    // Wait for store to hydrate from localStorage first
    if (!_hasHydrated) return
    if (hasAppliedDefaultRef.current) return

    // Only apply default filter if URL has no params
    const currentUrl = searchParams?.toString() || ''
    if (currentUrl) {
      hasAppliedDefaultRef.current = true
      return
    }

    // If default filter is 'all', nothing to apply
    if (defaultFilter === 'all' || !defaultFilter) {
      hasAppliedDefaultRef.current = true
      return
    }

    let targetFilters = { ...DEFAULT_FILTERS }

    if (defaultFilter === 'unread') {
      targetFilters.unreadOnly = true
    } else if (defaultFilter === 'assigned' && session?.user?.id) {
      targetFilters.assignedTo = session.user.id
    } else if (defaultFilter === 'urgent') {
      targetFilters.status = 'active'
    } else {
      hasAppliedDefaultRef.current = true
      return
    }

    hasAppliedDefaultRef.current = true

    // Apply filter to store
    isUpdatingRef.current = true
    setAllFilters(targetFilters)

    // Update URL to reflect the filter
    const newParams = buildParamsFromFilters(targetFilters)
    if (newParams) {
      lastSetUrlRef.current = newParams
      router.replace(`${pathname}?${newParams}`, { scroll: false })
    }

    setTimeout(() => { isUpdatingRef.current = false }, 50)
  }, [_hasHydrated, defaultFilter, session?.user?.id, pathname, router, searchParams, setAllFilters]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync URL -> Store (only on initial load or URL change from outside)
  useEffect(() => {
    if (isUpdatingRef.current) return

    const currentUrl = searchParams?.toString() || ''

    // Skip if this is a URL we just set ourselves
    if (currentUrl === lastSetUrlRef.current) return

    // If URL has no params, reset to default filters (default filter is handled by separate useEffect)
    if (!currentUrl) {
      if (!areFiltersEqual(filters, DEFAULT_FILTERS) && !hasAppliedDefaultRef.current) {
        isUpdatingRef.current = true
        setAllFilters(DEFAULT_FILTERS)
        setTimeout(() => { isUpdatingRef.current = false }, 0)
      }
      return
    }

    // If URL has params, sync to store
    if (!areFiltersEqual(filters, parsedFilters)) {
      isUpdatingRef.current = true
      setAllFilters(parsedFilters)
      setTimeout(() => { isUpdatingRef.current = false }, 0)
    }
  }, [searchParams, parsedFilters]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync Store -> URL (when filters change from user interaction)
  useEffect(() => {
    if (isUpdatingRef.current) return
    if (!pathname) return

    const currentParams = searchParams?.toString() || ''

    // If filters are default, clear URL
    if (isDefaultFilters(filters)) {
      if (currentParams) {
        isUpdatingRef.current = true
        lastSetUrlRef.current = ''
        router.replace(pathname, { scroll: false })
        setTimeout(() => { isUpdatingRef.current = false }, 50)
      }
      return
    }

    // Build new URL params
    const nextParams = buildParamsFromFilters(filters)

    // Skip if params are the same
    if (nextParams === currentParams) return

    // Update URL
    isUpdatingRef.current = true
    lastSetUrlRef.current = nextParams
    const nextUrl = nextParams ? `${pathname}?${nextParams}` : pathname
    router.replace(nextUrl, { scroll: false })
    setTimeout(() => { isUpdatingRef.current = false }, 50)
  }, [filters, pathname]) // eslint-disable-line react-hooks/exhaustive-deps
}
