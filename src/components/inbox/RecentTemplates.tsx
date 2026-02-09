'use client'

import { useSettingsStore } from '@/stores/settings'
import { useTemplates } from '@/hooks/use-templates'
import { Button } from '@/components/ui/button'
import { Clock, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RecentTemplatesProps {
  onSelectTemplate: (template: any) => void
  className?: string
}

export function RecentTemplates({ onSelectTemplate, className }: RecentTemplatesProps) {
  const recentTemplateIds = useSettingsStore((state) => state.recentTemplateIds)
  const { data: templates } = useTemplates()

  // Filter templates to only show recent ones
  const recentTemplates = templates?.filter((template) =>
    recentTemplateIds.includes(template.id.toString())
  ) || []

  // Sort by recent order
  const sortedTemplates = recentTemplates.sort((a, b) => {
    const aIndex = recentTemplateIds.indexOf(a.id.toString())
    const bIndex = recentTemplateIds.indexOf(b.id.toString())
    return aIndex - bIndex
  })

  if (sortedTemplates.length === 0) {
    return null
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-2 text-xs font-medium text-gray-500 px-2">
        <Clock className="h-3 w-3" />
        Recently Used Templates
      </div>
      <div className="space-y-1">
        {sortedTemplates.map((template) => (
          <Button
            key={template.id}
            variant="ghost"
            size="sm"
            onClick={() => onSelectTemplate(template)}
            className="w-full justify-start text-left h-auto py-2 px-3"
          >
            <div className="flex items-start gap-2 w-full">
              <FileText className="h-4 w-4 mt-0.5 flex-shrink-0 text-gray-500" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {template.name}
                </div>
                {template.shortcuts && template.shortcuts.length > 0 && (
                  <div className="text-xs text-gray-500">
                    {template.shortcuts[0]}
                  </div>
                )}
              </div>
            </div>
          </Button>
        ))}
      </div>
    </div>
  )
}
