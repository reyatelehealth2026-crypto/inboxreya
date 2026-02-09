import { useCallback } from 'react'
import { useSettingsStore } from '@/stores/settings'
import { useMutation, useQueryClient } from '@tanstack/react-query'

/**
 * Hook for tracking template usage
 */
export function useTemplateTracking() {
  const addRecentTemplate = useSettingsStore((state) => state.addRecentTemplate)
  const queryClient = useQueryClient()

  const trackTemplateUsage = useMutation({
    mutationFn: async (templateId: string) => {
      // Call API to increment usage count
      const response = await fetch(`/api/inbox/templates/${templateId}/use`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Failed to track template usage')
      }

      return response.json()
    },
    onSuccess: (_, templateId) => {
      // Add to recent templates in settings store
      addRecentTemplate(templateId)

      // Invalidate templates query to refresh usage counts
      queryClient.invalidateQueries({ queryKey: ['templates'] })
    },
  })

  const trackTemplate = useCallback(
    (templateId: string) => {
      trackTemplateUsage.mutate(templateId)
    },
    [trackTemplateUsage]
  )

  return {
    trackTemplate,
    isTracking: trackTemplateUsage.isPending,
  }
}
