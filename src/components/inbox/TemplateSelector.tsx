"use client"

import { useMemo, useState } from 'react'
import type { LineUser, QuickReplyTemplate } from '@/types'
import { useTemplates } from '@/hooks/use-templates'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'

const buildDisplayName = (user?: LineUser | null) => {
  if (!user) return ''
  if (user.displayName) return user.displayName
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ')
  return fullName || ''
}

const applyTemplatePlaceholders = (content: string, user?: LineUser | null) => {
  const displayName = buildDisplayName(user)
  const replacements: Record<string, string> = {
    name: displayName,
    first_name: user?.firstName || '',
    last_name: user?.lastName || '',
    phone: user?.phone || '',
    email: user?.email || '',
    line_user_id: user?.lineUserId || '',
  }

  return content.replace(/\{([^}]+)\}/g, (match, key) => {
    const normalized = String(key).trim().toLowerCase()
    if (Object.prototype.hasOwnProperty.call(replacements, normalized)) {
      return replacements[normalized]
    }
    return match
  })
}

const normalizeTemplate = (template: QuickReplyTemplate) => ({
  ...template,
  category: template.category?.trim() || 'ทั่วไป',
})

export function TemplateSelector({
  user,
  onSelect,
  onClearFile,
  mode = 'dropdown',
  searchQuery,
  onSearchChange,
}: {
  user?: LineUser | null
  onSelect: (content: string) => void
  onClearFile?: () => void
  mode?: 'dropdown' | 'inline'
  searchQuery?: string
  onSearchChange?: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const resolvedSearch = searchQuery ?? search
  const { data: templates = [], isLoading, error } = useTemplates(resolvedSearch.trim())

  const groupedTemplates = useMemo(() => {
    const groups = new Map<string, QuickReplyTemplate[]>()
    templates.map(normalizeTemplate).forEach((template) => {
      const category = template.category || 'ทั่วไป'
      const list = groups.get(category) || []
      list.push(template)
      groups.set(category, list)
    })
    return Array.from(groups.entries())
  }, [templates])

  const handleSelect = (template: QuickReplyTemplate) => {
    const resolved = applyTemplatePlaceholders(template.content, user)
    onClearFile?.()
    onSelect(resolved)
    setOpen(false)
  }

  const panel = (
    <div className={mode === 'inline' ? 'w-full rounded-lg border bg-background' : 'absolute z-50 mt-2 w-80 max-w-[90vw] rounded-lg border bg-background shadow-lg'}>
      <div className="p-3 border-b">
        <Input
          value={resolvedSearch}
          onChange={(event) => {
            const next = event.target.value
            if (onSearchChange) {
              onSearchChange(next)
            } else {
              setSearch(next)
            }
          }}
          placeholder="ค้นหาเทมเพลต..."
          className="h-8"
        />
      </div>

      <ScrollArea className={mode === 'inline' ? 'max-h-60' : 'max-h-72'}>
        <div className="p-3 space-y-3">
          {isLoading && (
            <div className="text-sm text-muted-foreground">กำลังโหลดเทมเพลต...</div>
          )}

          {!isLoading && error && (
            <div className="text-sm text-destructive">โหลดเทมเพลตไม่สำเร็จ</div>
          )}

          {!isLoading && !error && groupedTemplates.length === 0 && (
            <div className="text-sm text-muted-foreground">ไม่พบเทมเพลต</div>
          )}

          {groupedTemplates.map(([category, items]) => (
            <div key={category} className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">{category}</span>
                <Badge variant="secondary" className="text-[10px] px-2">
                  {items.length}
                </Badge>
              </div>
              <div className="space-y-2">
                {items.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => handleSelect(template)}
                    className="w-full text-left rounded-md border px-3 py-2 hover:bg-muted/60 transition"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">{template.name}</span>
                      {template.shortcuts?.length ? (
                        <Badge variant="outline" className="text-[10px]">
                          Quick Reply
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                      {template.content}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )

  if (mode === 'inline') {
    return panel
  }

  return (
    <div className="relative">
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen((prev) => !prev)}
      >
        เทมเพลต
      </Button>

      {open && panel}
    </div>
  )
}
