'use client'

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import {
  Trash2,
  Plus,
  Bookmark,
  Sparkles,
  AlertTriangle,
  ExternalLink,
  Tag as TagIcon,
  LayoutGrid,
  Check,
  X,
  Maximize2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import type { ImagemapRegion } from '@/lib/imagemap-types'
import type { UserTag } from '@/types'

const LOCAL_STORAGE_LAYOUTS_KEY = 'reya_imagemap_saved_layouts_v1'

interface SavedLayout {
  name: string
  regions: Array<{ x: number; y: number; w: number; h: number }>
}

interface ImagemapRegionEditorProps {
  baseKey: string
  baseUrl: string
  imageWidth: number // Always 1040
  imageHeight: number
  previewUrl: string
  regions: ImagemapRegion[]
  onChangeRegions: (regions: ImagemapRegion[]) => void
  tags: UserTag[]
  onCreateTag?: (name: string) => Promise<UserTag | null>
}

function checkOverlap(
  r1: { x: number; y: number; w: number; h: number },
  r2: { x: number; y: number; w: number; h: number }
): boolean {
  return !(
    r1.x + r1.w <= r2.x ||
    r2.x + r2.w <= r1.x ||
    r1.y + r1.h <= r2.y ||
    r2.y + r2.h <= r1.y
  )
}

function stripInterestPrefix(tagName: string): string {
  return tagName.replace(/^สนใจ\s*:\s*/i, '').trim()
}

export function ImagemapRegionEditor({
  baseKey: _baseKey,
  baseUrl: _baseUrl,
  imageWidth,
  imageHeight,
  previewUrl,
  regions,
  onChangeRegions,
  tags,
  onCreateTag,
}: ImagemapRegionEditorProps) {
  const { toast } = useToast()
  const containerRef = useRef<HTMLDivElement>(null)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [dragMode, setDragMode] = useState<'move' | 'nw' | 'ne' | 'se' | 'sw' | null>(null)
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null)
  const [initialRect, setInitialRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [currentDragRect, setCurrentDragRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null)

  // Layout save/load
  const [customLayouts, setCustomLayouts] = useState<SavedLayout[]>([])
  const [layoutNameInput, setLayoutNameInput] = useState('')
  const [showSaveLayout, setShowSaveLayout] = useState(false)

  // New tag inline state
  const [newTagName, setNewTagName] = useState('')
  const [isCreatingTag, setIsCreatingTag] = useState(false)

  // Determine current origin for promo URLs
  const origin = useMemo(() => {
    if (typeof window !== 'undefined') {
      return window.location.origin
    }
    return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  }, [])

  // Load custom layouts from localStorage
  // ponytail: per-browser; move to DB if the team needs shared layouts
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_LAYOUTS_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          setCustomLayouts(parsed)
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [])

  const saveCustomLayout = () => {
    if (!layoutNameInput.trim()) {
      toast({ title: 'กรุณาตั้งชื่อ Layout', variant: 'destructive' })
      return
    }
    if (regions.length === 0) {
      toast({ title: 'ยังไม่มีกรอบในภาพให้บันทึก', variant: 'destructive' })
      return
    }

    const newLayout: SavedLayout = {
      name: layoutNameInput.trim(),
      regions: regions.map((r) => ({ x: r.x, y: r.y, w: r.w, h: r.h })),
    }

    const updated = [...customLayouts.filter((l) => l.name !== newLayout.name), newLayout]
    setCustomLayouts(updated)
    setLayoutNameInput('')
    setShowSaveLayout(false)

    try {
      localStorage.setItem(LOCAL_STORAGE_LAYOUTS_KEY, JSON.stringify(updated))
      toast({ title: `บันทึก Layout "${newLayout.name}" สำเร็จ` })
    } catch {
      toast({ title: 'ไม่สามารถบันทึกลงเบราว์เซอร์ได้', variant: 'destructive' })
    }
  }

  const deleteCustomLayout = (name: string) => {
    const updated = customLayouts.filter((l) => l.name !== name)
    setCustomLayouts(updated)
    try {
      localStorage.setItem(LOCAL_STORAGE_LAYOUTS_KEY, JSON.stringify(updated))
    } catch {
      // ignore
    }
  }

  // Built-in preset layouts
  const applyPresetLayout = (preset: 'full' | '2-h' | '2-v' | '4-grid' | '6-grid' | SavedLayout) => {
    let geometries: Array<{ x: number; y: number; w: number; h: number }> = []

    if (typeof preset === 'object') {
      geometries = preset.regions
    } else if (preset === 'full') {
      geometries = [{ x: 0, y: 0, w: imageWidth, h: imageHeight }]
    } else if (preset === '2-h') {
      const halfH = Math.round(imageHeight / 2)
      geometries = [
        { x: 0, y: 0, w: imageWidth, h: halfH },
        { x: 0, y: halfH, w: imageWidth, h: imageHeight - halfH },
      ]
    } else if (preset === '2-v') {
      const halfW = Math.round(imageWidth / 2)
      geometries = [
        { x: 0, y: 0, w: halfW, h: imageHeight },
        { x: halfW, y: 0, w: imageWidth - halfW, h: imageHeight },
      ]
    } else if (preset === '4-grid') {
      const halfW = Math.round(imageWidth / 2)
      const halfH = Math.round(imageHeight / 2)
      geometries = [
        { x: 0, y: 0, w: halfW, h: halfH },
        { x: halfW, y: 0, w: imageWidth - halfW, h: halfH },
        { x: 0, y: halfH, w: halfW, h: imageHeight - halfH },
        { x: halfW, y: halfH, w: imageWidth - halfW, h: imageHeight - halfH },
      ]
    } else if (preset === '6-grid') {
      const halfW = Math.round(imageWidth / 2)
      const thirdH = Math.round(imageHeight / 3)
      geometries = [
        { x: 0, y: 0, w: halfW, h: thirdH },
        { x: halfW, y: 0, w: imageWidth - halfW, h: thirdH },
        { x: 0, y: thirdH, w: halfW, h: thirdH },
        { x: halfW, y: thirdH, w: imageWidth - halfW, h: thirdH },
        { x: 0, y: thirdH * 2, w: halfW, h: imageHeight - thirdH * 2 },
        { x: halfW, y: thirdH * 2, w: imageWidth - halfW, h: imageHeight - thirdH * 2 },
      ]
    }

    const nextRegions: ImagemapRegion[] = geometries.map((geo, idx) => {
      const existing = regions[idx]
      return {
        ...geo,
        url: existing?.url || `${origin}/promo`,
        tagId: existing?.tagId,
        keyword: existing?.keyword,
      }
    })

    onChangeRegions(nextRegions)
    setSelectedIndex(0)
    toast({ title: 'นำ Layout มาใช้เรียบร้อย' })
  }

  // Convert display client coordinates to 1040-space image coordinates
  const clientToImageCoords = useCallback(
    (clientX: number, clientY: number) => {
      if (!containerRef.current) return { x: 0, y: 0 }
      const rect = containerRef.current.getBoundingClientRect()
      const scaleX = imageWidth / rect.width
      const scaleY = imageHeight / rect.height
      const x = Math.round(Math.max(0, Math.min(imageWidth, (clientX - rect.left) * scaleX)))
      const y = Math.round(Math.max(0, Math.min(imageHeight, (clientY - rect.top) * scaleY)))
      return { x, y }
    },
    [imageWidth, imageHeight]
  )

  // Pointer event handlers for drawing or resizing
  const handlePointerDown = (e: React.PointerEvent) => {
    // If clicked on an interactive control inside, don't start drawing
    if ((e.target as HTMLElement).closest('[data-no-drag]')) return

    const coords = clientToImageCoords(e.clientX, e.clientY)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)

    if (regions.length >= 12) {
      toast({ title: 'สร้างได้สูงสุด 12 กรอบเท่านั้น', variant: 'destructive' })
      return
    }

    setIsDrawing(true)
    setStartPoint(coords)
    setCurrentDragRect({ x: coords.x, y: coords.y, w: 0, h: 0 })
    setSelectedIndex(null)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!containerRef.current) return

    if (isDrawing && startPoint) {
      const current = clientToImageCoords(e.clientX, e.clientY)
      const x = Math.min(startPoint.x, current.x)
      const y = Math.min(startPoint.y, current.y)
      const w = Math.abs(current.x - startPoint.x)
      const h = Math.abs(current.y - startPoint.y)
      setCurrentDragRect({ x, y, w, h })
      return
    }

    if (dragMode && selectedIndex !== null && startPoint && initialRect) {
      const current = clientToImageCoords(e.clientX, e.clientY)
      const dx = current.x - startPoint.x
      const dy = current.y - startPoint.y

      let newRect = { ...initialRect }

      if (dragMode === 'move') {
        newRect.x = Math.max(0, Math.min(imageWidth - initialRect.w, initialRect.x + dx))
        newRect.y = Math.max(0, Math.min(imageHeight - initialRect.h, initialRect.y + dy))
      } else if (dragMode === 'se') {
        newRect.w = Math.max(20, Math.min(imageWidth - initialRect.x, initialRect.w + dx))
        newRect.h = Math.max(20, Math.min(imageHeight - initialRect.y, initialRect.h + dy))
      } else if (dragMode === 'sw') {
        const right = initialRect.x + initialRect.w
        const newX = Math.max(0, Math.min(right - 20, initialRect.x + dx))
        newRect.x = newX
        newRect.w = right - newX
        newRect.h = Math.max(20, Math.min(imageHeight - initialRect.y, initialRect.h + dy))
      } else if (dragMode === 'ne') {
        const bottom = initialRect.y + initialRect.h
        const newY = Math.max(0, Math.min(bottom - 20, initialRect.y + dy))
        newRect.y = newY
        newRect.h = bottom - newY
        newRect.w = Math.max(20, Math.min(imageWidth - initialRect.x, initialRect.w + dx))
      } else if (dragMode === 'nw') {
        const right = initialRect.x + initialRect.w
        const bottom = initialRect.y + initialRect.h
        const newX = Math.max(0, Math.min(right - 20, initialRect.x + dx))
        const newY = Math.max(0, Math.min(bottom - 20, initialRect.y + dy))
        newRect.x = newX
        newRect.w = right - newX
        newRect.y = newY
        newRect.h = bottom - newY
      }

      setCurrentDragRect(newRect)
    }
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    try {
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      // ignore
    }

    if (isDrawing && currentDragRect) {
      setIsDrawing(false)
      setStartPoint(null)

      if (currentDragRect.w < 20 || currentDragRect.h < 20) {
        setCurrentDragRect(null)
        return
      }

      // Check collision with existing regions
      const hasOverlap = regions.some((other) => checkOverlap(currentDragRect, other))
      if (hasOverlap) {
        toast({
          title: 'กรอบทับซ้อนกับจุดเดิม',
          description: 'LINE Imagemap ไม่อนุญาตให้กรอบทับซ้อนกัน กรุณาวาดในพื้นที่ว่าง',
          variant: 'destructive',
        })
        setCurrentDragRect(null)
        return
      }

      if (currentDragRect.w < 200 || currentDragRect.h < 200) {
        toast({
          title: 'ข้อแนะนำขนาดกรอบ',
          description: 'กรอบมีขนาดเล็กกว่า 200px อาจทำให้กดบนมือถือได้ยาก',
        })
      }

      const newRegion: ImagemapRegion = {
        ...currentDragRect,
        url: `${origin}/promo`,
      }
      const updated = [...regions, newRegion]
      onChangeRegions(updated)
      setSelectedIndex(updated.length - 1)
      setCurrentDragRect(null)
      return
    }

    if (dragMode && selectedIndex !== null && currentDragRect) {
      setDragMode(null)
      setStartPoint(null)
      setInitialRect(null)

      // Collision check with other regions
      const otherRegions = regions.filter((_, idx) => idx !== selectedIndex)
      const hasOverlap = otherRegions.some((other) => checkOverlap(currentDragRect, other))

      if (hasOverlap) {
        toast({
          title: 'ตำแหน่งใหม่ทับซ้อนกับกรอบอื่น',
          description: 'คืนค่าตำแหน่งเดิม',
          variant: 'destructive',
        })
        setCurrentDragRect(null)
        return
      }

      const updated = [...regions]
      updated[selectedIndex] = {
        ...updated[selectedIndex],
        ...currentDragRect,
      }
      onChangeRegions(updated)
      setCurrentDragRect(null)
    }
  }

  const startDragHandle = (
    e: React.PointerEvent,
    mode: 'move' | 'nw' | 'ne' | 'se' | 'sw',
    index: number
  ) => {
    e.stopPropagation()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    setSelectedIndex(index)
    setDragMode(mode)
    const coords = clientToImageCoords(e.clientX, e.clientY)
    setStartPoint(coords)
    setInitialRect({
      x: regions[index].x,
      y: regions[index].y,
      w: regions[index].w,
      h: regions[index].h,
    })
    setCurrentDragRect({
      x: regions[index].x,
      y: regions[index].y,
      w: regions[index].w,
      h: regions[index].h,
    })
  }

  const handleDeleteRegion = (index: number) => {
    const updated = regions.filter((_, i) => i !== index)
    onChangeRegions(updated)
    if (selectedIndex === index) {
      setSelectedIndex(updated.length > 0 ? Math.max(0, index - 1) : null)
    } else if (selectedIndex !== null && selectedIndex > index) {
      setSelectedIndex(selectedIndex - 1)
    }
  }

  const updateRegionField = (index: number, patch: Partial<ImagemapRegion>) => {
    const updated = [...regions]
    updated[index] = { ...updated[index], ...patch }
    onChangeRegions(updated)
  }

  const handleSelectTag = (index: number, tagIdStr: string) => {
    if (tagIdStr === 'none') {
      updateRegionField(index, { tagId: undefined })
      return
    }
    const tagId = Number(tagIdStr)
    const tag = tags.find((t) => Number(t.id) === tagId)
    const currentRegion = regions[index]
    const patch: Partial<ImagemapRegion> = { tagId }

    // If keyword is not set or was empty, default to tag name without "สนใจ:"
    if (!currentRegion.keyword && tag) {
      const defaultKeyword = stripInterestPrefix(tag.name)
      patch.keyword = defaultKeyword
      if (currentRegion.url.startsWith(`${origin}/promo`)) {
        patch.url = `${origin}/promo?k=${encodeURIComponent(defaultKeyword)}`
      }
    }
    updateRegionField(index, patch)
  }

  const handleCreateNewTag = async (regionIndex: number) => {
    if (!newTagName.trim() || !onCreateTag) return
    setIsCreatingTag(true)
    try {
      const created = await onCreateTag(newTagName.trim())
      if (created) {
        handleSelectTag(regionIndex, String(created.id))
        setNewTagName('')
        toast({ title: `สร้าง Tag "${created.name}" สำเร็จ` })
      }
    } catch (err) {
      toast({
        title: 'สร้าง Tag ล้มเหลว',
        description: err instanceof Error ? err.message : 'กรุณาลองใหม่',
        variant: 'destructive',
      })
    } finally {
      setIsCreatingTag(false)
    }
  }

  const selectedRegion = selectedIndex !== null ? regions[selectedIndex] : null

  return (
    <div className="space-y-4">
      {/* Top Bar: Layouts & Region count */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
        <div className="flex items-center gap-2">
          <Badge variant={regions.length > 0 ? 'default' : 'outline'} className="gap-1">
            <LayoutGrid className="h-3.5 w-3.5" />
            จุดกด: {regions.length}/12 ช่อง
          </Badge>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            (ลากเมาส์บนภาพเพื่อวาดกรอบ หรือเลือก Layout สำเร็จรูป)
          </span>
        </div>

        {/* Preset & Custom Layout Controls */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Select onValueChange={(val) => applyPresetLayout(val as any)}>
            <SelectTrigger className="h-8 text-xs w-[140px]">
              <SelectValue placeholder="เลือก Layout ด่วน" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="full">1 ช่อง (เต็มภาพ)</SelectItem>
              <SelectItem value="2-h">2 ช่อง (บน-ล่าง)</SelectItem>
              <SelectItem value="2-v">2 ช่อง (ซ้าย-ขวา)</SelectItem>
              <SelectItem value="4-grid">4 ช่อง (2x2)</SelectItem>
              <SelectItem value="6-grid">6 ช่อง (2x3)</SelectItem>
              {customLayouts.map((cl) => (
                <SelectItem key={cl.name} value={cl as any}>
                  ⭐ {cl.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {showSaveLayout ? (
            <div className="flex items-center gap-1">
              <Input
                value={layoutNameInput}
                onChange={(e) => setLayoutNameInput(e.target.value)}
                placeholder="ชื่อ Layout..."
                className="h-8 text-xs w-28"
              />
              <Button size="sm" className="h-8 px-2" onClick={saveCustomLayout}>
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setShowSaveLayout(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1"
              onClick={() => setShowSaveLayout(true)}
              disabled={regions.length === 0}
            >
              <Bookmark className="h-3.5 w-3.5" />
              บันทึก Layout
            </Button>
          )}

          {regions.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground hover:text-destructive"
              onClick={() => {
                onChangeRegions([])
                setSelectedIndex(null)
              }}
            >
              ล้างทั้งหมด
            </Button>
          )}
        </div>
      </div>

      {/* Main Workspace: Left Image Canvas + Right Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left 7 cols: Image Canvas */}
        <div className="lg:col-span-7 flex flex-col items-center">
          <div
            ref={containerRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="relative w-full select-none touch-none overflow-hidden rounded-lg border bg-neutral-900 shadow-inner cursor-crosshair"
            style={{
              aspectRatio: `${imageWidth} / ${imageHeight}`,
            }}
          >
            {/* Background Preview Image */}
            <img
              src={previewUrl}
              alt="Imagemap canvas"
              className="pointer-events-none absolute inset-0 h-full w-full object-contain"
              draggable={false}
            />

            {/* Existing Regions */}
            {regions.map((region, idx) => {
              const isSelected = selectedIndex === idx
              const displayRect = isSelected && currentDragRect ? currentDragRect : region

              const leftPct = (displayRect.x / imageWidth) * 100
              const topPct = (displayRect.y / imageHeight) * 100
              const widthPct = (displayRect.w / imageWidth) * 100
              const heightPct = (displayRect.h / imageHeight) * 100

              const tag = tags.find((t) => Number(t.id) === region.tagId)
              const hasWarning = displayRect.w < 200 || displayRect.h < 200

              return (
                <div
                  key={idx}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedIndex(idx)
                  }}
                  className={`absolute transition-[border-color,box-shadow] flex flex-col justify-between p-1 select-none ${
                    isSelected
                      ? 'border-2 border-primary bg-primary/25 shadow-lg shadow-primary/30 z-20 cursor-move'
                      : 'border-2 border-dashed border-emerald-400/90 bg-emerald-500/20 hover:bg-emerald-500/30 z-10 cursor-pointer'
                  }`}
                  style={{
                    left: `${leftPct}%`,
                    top: `${topPct}%`,
                    width: `${widthPct}%`,
                    height: `${heightPct}%`,
                  }}
                  onPointerDown={
                    isSelected ? (e) => startDragHandle(e, 'move', idx) : undefined
                  }
                >
                  {/* Badge & Info Header */}
                  <div className="flex items-center justify-between gap-1 pointer-events-none">
                    <span
                      className={`inline-flex items-center justify-center rounded-full font-bold text-[10px] h-5 w-5 ${
                        isSelected
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-emerald-600 text-white'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    {tag && (
                      <span className="truncate max-w-[90px] rounded bg-black/60 px-1 py-0.5 text-[9px] text-white">
                        {tag.name}
                      </span>
                    )}
                    {hasWarning && (
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-300 drop-shadow" />
                    )}
                  </div>

                  {/* Coordinates label */}
                  <div className="text-[9px] font-mono text-white/90 bg-black/50 px-1 rounded self-end pointer-events-none">
                    {displayRect.w}×{displayRect.h}
                  </div>

                  {/* Resize Handles (Only on Selected) */}
                  {isSelected && (
                    <>
                      <div
                        onPointerDown={(e) => startDragHandle(e, 'nw', idx)}
                        className="absolute -top-1.5 -left-1.5 h-3.5 w-3.5 rounded-full bg-primary border-2 border-white cursor-nwse-resize z-30"
                      />
                      <div
                        onPointerDown={(e) => startDragHandle(e, 'ne', idx)}
                        className="absolute -top-1.5 -right-1.5 h-3.5 w-3.5 rounded-full bg-primary border-2 border-white cursor-nesw-resize z-30"
                      />
                      <div
                        onPointerDown={(e) => startDragHandle(e, 'se', idx)}
                        className="absolute -bottom-1.5 -right-1.5 h-3.5 w-3.5 rounded-full bg-primary border-2 border-white cursor-nwse-resize z-30"
                      />
                      <div
                        onPointerDown={(e) => startDragHandle(e, 'sw', idx)}
                        className="absolute -bottom-1.5 -left-1.5 h-3.5 w-3.5 rounded-full bg-primary border-2 border-white cursor-nesw-resize z-30"
                      />
                    </>
                  )}
                </div>
              )
            })}

            {/* In-progress drawing rectangle */}
            {isDrawing && currentDragRect && (
              <div
                className="absolute border-2 border-dashed border-primary bg-primary/20 pointer-events-none z-30"
                style={{
                  left: `${(currentDragRect.x / imageWidth) * 100}%`,
                  top: `${(currentDragRect.y / imageHeight) * 100}%`,
                  width: `${(currentDragRect.w / imageWidth) * 100}%`,
                  height: `${(currentDragRect.h / imageHeight) * 100}%`,
                }}
              >
                <span className="m-1 rounded bg-black/70 px-1 py-0.5 text-[9px] font-mono text-white">
                  {currentDragRect.w}×{currentDragRect.h}
                </span>
              </div>
            )}
          </div>

          <p className="mt-2 text-center text-xs text-muted-foreground">
            ภาพขนาดจริง {imageWidth}×{imageHeight}px • คลิกที่กรอบเพื่อปรับขนาดหรือเลื่อนตำแหน่ง
          </p>
        </div>

        {/* Right 5 cols: Region Inspector & Form */}
        <div className="lg:col-span-5 space-y-3" data-no-drag>
          {regions.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center p-6 text-center text-muted-foreground">
                <Maximize2 className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm font-medium">ยังไม่ได้สร้างจุดกด</p>
                <p className="text-xs mt-1">
                  ลากเมาส์วาดกรอบสี่เหลี่ยมบนภาพ หรือเลือก Layout ด่วนด้านบน
                </p>
              </CardContent>
            </Card>
          ) : selectedRegion && selectedIndex !== null ? (
            <Card className="border-primary/40 shadow-sm">
              <CardContent className="space-y-4 p-4">
                {/* Region header */}
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="flex items-center gap-2">
                    <Badge className="h-6 w-6 rounded-full p-0 flex items-center justify-center text-xs">
                      {selectedIndex + 1}
                    </Badge>
                    <span className="text-sm font-semibold">ตั้งค่าจุดกดช่องที่ {selectedIndex + 1}</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-destructive hover:bg-destructive/10"
                    onClick={() => handleDeleteRegion(selectedIndex)}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> ลบช่องนี้
                  </Button>
                </div>

                {/* Region size warnings if < 200px */}
                {(selectedRegion.w < 200 || selectedRegion.h < 200) && (
                  <div className="flex items-start gap-2 rounded-md bg-amber-500/10 border border-amber-500/30 p-2 text-xs text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                      ขนาดกรอบ ({selectedRegion.w}×{selectedRegion.h}px) เล็กกว่า 200px — LINE แนะนำให้กว้าง/สูงอย่างน้อย 200px เพื่อให้ผู้ใช้กดได้ง่ายบนมือถือ
                    </span>
                  </div>
                )}

                {/* Destination Selector */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">ปลายทางเมื่อลูกค้ากด</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={selectedRegion.url.startsWith(`${origin}/promo`) ? 'default' : 'outline'}
                      className="text-xs h-8"
                      onClick={() => {
                        const kw = selectedRegion.keyword || ''
                        const newUrl = kw
                          ? `${origin}/promo?k=${encodeURIComponent(kw)}`
                          : `${origin}/promo`
                        updateRegionField(selectedIndex, { url: newUrl })
                      }}
                    >
                      หน้ารวมโปรโมชัน
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={!selectedRegion.url.startsWith(`${origin}/promo`) ? 'default' : 'outline'}
                      className="text-xs h-8"
                      onClick={() => {
                        if (selectedRegion.url.startsWith(`${origin}/promo`)) {
                          updateRegionField(selectedIndex, { url: 'https://' })
                        }
                      }}
                    >
                      กำหนด URL เอง
                    </Button>
                  </div>
                </div>

                {/* Promo keyword or Custom URL */}
                {selectedRegion.url.startsWith(`${origin}/promo`) ? (
                  <div className="space-y-1.5 rounded-lg border bg-muted/20 p-2.5">
                    <Label className="text-xs">คำค้นโปรโมชัน (เพื่อดันสินค้านั้นขึ้นบนสุด)</Label>
                    <Input
                      value={selectedRegion.keyword || ''}
                      onChange={(e) => {
                        const kw = e.target.value
                        const newUrl = kw
                          ? `${origin}/promo?k=${encodeURIComponent(kw)}`
                          : `${origin}/promo`
                        updateRegionField(selectedIndex, { keyword: kw, url: newUrl })
                      }}
                      placeholder="เช่น SOS Plus, ยาแก้ไอ, หน้ากาก"
                      className="h-8 text-xs"
                    />
                    <p className="text-[10px] text-muted-foreground truncate">
                      ปลายทาง: {selectedRegion.url}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label className="text-xs">URL ปลายทาง (ต้องขึ้นต้นด้วย https://)</Label>
                    <Input
                      value={selectedRegion.url}
                      onChange={(e) => updateRegionField(selectedIndex, { url: e.target.value })}
                      placeholder="https://example.com/..."
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                )}

                {/* Interest Tag */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium flex items-center gap-1">
                      <TagIcon className="h-3 w-3 text-primary" />
                      ติด Tag อัตโนมัติเมื่อกด (Interest Tag)
                    </Label>
                  </div>

                  <Select
                    value={selectedRegion.tagId ? String(selectedRegion.tagId) : 'none'}
                    onValueChange={(val) => handleSelectTag(selectedIndex, val)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="ไม่ระบุ Tag" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">-- ไม่ติด Tag --</SelectItem>
                      {tags.map((t) => (
                        <SelectItem key={t.id} value={String(t.id)}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Inline create new tag */}
                  {onCreateTag && (
                    <div className="flex items-center gap-1.5 pt-1">
                      <Input
                        value={newTagName}
                        onChange={(e) => setNewTagName(e.target.value)}
                        placeholder="ชื่อ Tag ใหม่ (เช่น สนใจ:SOS Plus)..."
                        className="h-7 text-xs"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="h-7 px-2 text-xs shrink-0 gap-1"
                        onClick={() => handleCreateNewTag(selectedIndex)}
                        disabled={!newTagName.trim() || isCreatingTag}
                      >
                        <Plus className="h-3 w-3" /> สร้าง Tag
                      </Button>
                    </div>
                  )}
                </div>

                {/* Coordinate adjustment inputs (Accessibility & precision) */}
                <div className="space-y-1.5 border-t pt-2">
                  <Label className="text-[11px] text-muted-foreground">พิกัดในภาพ (1040px Space)</Label>
                  <div className="grid grid-cols-4 gap-1.5">
                    <div>
                      <span className="text-[10px] text-muted-foreground">X:</span>
                      <Input
                        type="number"
                        value={selectedRegion.x}
                        onChange={(e) =>
                          updateRegionField(selectedIndex, { x: Math.max(0, parseInt(e.target.value) || 0) })
                        }
                        className="h-7 text-xs px-1 font-mono"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground">Y:</span>
                      <Input
                        type="number"
                        value={selectedRegion.y}
                        onChange={(e) =>
                          updateRegionField(selectedIndex, { y: Math.max(0, parseInt(e.target.value) || 0) })
                        }
                        className="h-7 text-xs px-1 font-mono"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground">W:</span>
                      <Input
                        type="number"
                        value={selectedRegion.w}
                        onChange={(e) =>
                          updateRegionField(selectedIndex, { w: Math.max(20, parseInt(e.target.value) || 20) })
                        }
                        className="h-7 text-xs px-1 font-mono"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground">H:</span>
                      <Input
                        type="number"
                        value={selectedRegion.h}
                        onChange={(e) =>
                          updateRegionField(selectedIndex, { h: Math.max(20, parseInt(e.target.value) || 20) })
                        }
                        className="h-7 text-xs px-1 font-mono"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-4 text-center text-xs text-muted-foreground">
                คลิกเลือกกรอบบนภาพ เพื่อตั้งค่า URL ปลายทางและ Tag
              </CardContent>
            </Card>
          )}

          {/* Region List overview */}
          <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
            {regions.map((r, i) => {
              const tag = tags.find((t) => Number(t.id) === r.tagId)
              const isSelected = selectedIndex === i
              return (
                <div
                  key={i}
                  onClick={() => setSelectedIndex(i)}
                  className={`flex items-center justify-between p-2 rounded-md border text-xs cursor-pointer transition-colors ${
                    isSelected
                      ? 'border-primary bg-primary/10'
                      : 'hover:bg-muted/50 bg-background'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant={isSelected ? 'default' : 'outline'} className="h-4 w-4 p-0 flex items-center justify-center text-[10px]">
                      {i + 1}
                    </Badge>
                    <span className="truncate font-medium">
                      {r.url.startsWith(`${origin}/promo`)
                        ? `หน้ารวมโปร ${r.keyword ? `(${r.keyword})` : ''}`
                        : r.url}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {tag && <Badge variant="secondary" className="text-[9px] py-0 px-1">{tag.name}</Badge>}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteRegion(i)
                      }}
                      className="text-muted-foreground hover:text-destructive p-0.5 rounded"
                      title="ลบช่องนี้"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
