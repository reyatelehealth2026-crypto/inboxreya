'use client'

import { useState, useEffect } from 'react'
import { Check, ChevronsUpDown, X, UserPlus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

import { AdminUser } from '@/types'

interface AssigneeSelectorProps {
  conversationId: string
  currentAssignees: AdminUser[]
  onAssigneesChange?: (assignees: AdminUser[]) => void
  disabled?: boolean
  inline?: boolean
}

export function AssigneeSelector({
  conversationId,
  currentAssignees,
  onAssigneesChange,
  disabled = false,
  inline = false,
}: AssigneeSelectorProps) {
  const [open, setOpen] = useState(false)
  const [admins, setAdmins] = useState<AdminUser[]>([])
  const [selectedAdmins, setSelectedAdmins] = useState<AdminUser[]>(currentAssignees)
  const [loading, setLoading] = useState(false)
  const [updating, setUpdating] = useState(false)

  // Fetch available admins
  useEffect(() => {
    const fetchAdmins = async () => {
      setLoading(true)
      try {
        const response = await fetch('/api/inbox/admins')
        if (response.ok) {
          const data = await response.json()
          setAdmins(data.data || [])
        }
      } catch (error) {
        console.error('Failed to fetch admins:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchAdmins()
  }, [])

  // Update selected admins when currentAssignees changes
  useEffect(() => {
    setSelectedAdmins(currentAssignees)
  }, [currentAssignees])

  const handleToggleAdmin = async (admin: AdminUser) => {
    const isSelected = selectedAdmins.some((a) => a.id === admin.id)
    let newAssignees: AdminUser[]

    if (isSelected) {
      // Remove assignee
      newAssignees = selectedAdmins.filter((a) => a.id !== admin.id)
      setUpdating(true)

      try {
        const response = await fetch(
          `/api/inbox/conversations/${conversationId}/assignees`,
          {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminIds: [admin.id] }),
          }
        )

        if (!response.ok) {
          throw new Error('Failed to remove assignee')
        }

        setSelectedAdmins(newAssignees)
        onAssigneesChange?.(newAssignees)
      } catch (error) {
        console.error('Failed to remove assignee:', error)
        // Revert on error
        setSelectedAdmins(selectedAdmins)
      } finally {
        setUpdating(false)
      }
    } else {
      // Add assignee
      newAssignees = [...selectedAdmins, admin]
      setUpdating(true)

      try {
        const response = await fetch(
          `/api/inbox/conversations/${conversationId}/assignees`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminIds: [admin.id] }),
          }
        )

        if (!response.ok) {
          throw new Error('Failed to add assignee')
        }

        setSelectedAdmins(newAssignees)
        onAssigneesChange?.(newAssignees)
      } catch (error) {
        console.error('Failed to add assignee:', error)
        // Revert on error
        setSelectedAdmins(selectedAdmins)
      } finally {
        setUpdating(false)
      }
    }
  }

  const handleRemoveAssignee = async (adminId: string) => {
    const newAssignees = selectedAdmins.filter((a) => a.id !== adminId)
    setUpdating(true)

    try {
      const response = await fetch(
        `/api/inbox/conversations/${conversationId}/assignees`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ adminIds: [adminId] }),
        }
      )

      if (!response.ok) {
        throw new Error('Failed to remove assignee')
      }

      setSelectedAdmins(newAssignees)
      onAssigneesChange?.(newAssignees)
    } catch (error) {
      console.error('Failed to remove assignee:', error)
      // Revert on error
      setSelectedAdmins(selectedAdmins)
    } finally {
      setUpdating(false)
    }
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <div className={cn(inline ? "flex flex-wrap items-center gap-2" : "w-full")}>
      {/* Selected Assignees List */}
      {!inline && selectedAdmins.length > 0 && (
        <div className="space-y-2 mb-2">
          {selectedAdmins.map((admin) => (
            <div
              key={admin.id}
              className="flex items-center justify-between p-2 rounded-md bg-teal-50 border border-teal-100 group"
            >
              <div className="flex items-center gap-2.5 overflow-hidden">
                <Avatar className="h-8 w-8 ring-2 ring-white">
                  <AvatarImage src={admin.avatarUrl || undefined} />
                  <AvatarFallback className="text-xs bg-teal-200 text-teal-800 font-semibold">
                    {getInitials(admin.displayName || admin.username)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-semibold text-gray-900 truncate">
                    {admin.displayName || admin.username}
                  </span>
                  <span className="text-[10px] text-teal-700 font-medium truncate">
                    {admin.role || 'ผู้ดูแล'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleRemoveAssignee(admin.id)}
                disabled={disabled || updating}
                className="text-gray-500 hover:text-red-600 p-1 rounded-full hover:bg-white transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                title="ลบผู้ดูแล"
                aria-label={`ลบผู้ดูแล ${admin.displayName || admin.username}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Inline Badges (Legacy/Header support) */}
      {inline && selectedAdmins.length > 0 && (
        <div className="contents">
          {selectedAdmins.map((admin) => (
            <Badge
              key={admin.id}
              variant="secondary"
              className="flex items-center gap-1 pr-1 bg-teal-50 text-teal-700 hover:bg-teal-100 border-teal-200"
            >
              <Avatar className="h-4 w-4">
                <AvatarImage src={admin.avatarUrl || undefined} />
                <AvatarFallback className="text-[8px] bg-teal-100 text-teal-700">
                  {getInitials(admin.displayName || admin.username)}
                </AvatarFallback>
              </Avatar>
              <span className="text-[11px]">
                {admin.displayName || admin.username}
              </span>
              <button
                type="button"
                onClick={() => handleRemoveAssignee(admin.id)}
                disabled={disabled || updating}
                className="ml-1 rounded-full hover:bg-black/10 p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Add Assignee Button */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            role="combobox"
            aria-expanded={open}
            disabled={disabled || updating}
            className="h-6 w-6 rounded-full border border-dashed border-teal-300 bg-teal-50 text-teal-600 hover:bg-teal-100 hover:text-teal-700 hover:border-teal-400 p-0"
            title="เพิ่มผู้ดูแล"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search admins..." />
            <CommandList>
              <CommandEmpty>
                {loading ? 'Loading...' : 'No admin found.'}
              </CommandEmpty>
              <CommandGroup>
                {admins.map((admin) => {
                  const isSelected = selectedAdmins.some((a) => a.id === admin.id)
                  return (
                    <CommandItem
                      key={admin.id}
                      value={`${admin.username} ${admin.displayName || ''}`}
                      onSelect={() => handleToggleAdmin(admin)}
                      disabled={updating}
                    >
                      <div className="flex items-center gap-2 flex-1">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={admin.avatarUrl || undefined} />
                          <AvatarFallback className="text-xs">
                            {getInitials(admin.displayName || admin.username)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">
                            {admin.displayName || admin.username}
                          </span>
                          {admin.role && (
                            <span className="text-xs text-muted-foreground">
                              {admin.role}
                            </span>
                          )}
                        </div>
                      </div>
                      <Check
                        className={cn(
                          'ml-auto h-4 w-4',
                          isSelected ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
