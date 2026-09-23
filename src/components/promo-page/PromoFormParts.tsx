'use client'

import type { ReactNode } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** Building blocks of the /inbox/promo-page form: the live preview frame and the drag-to-order rows. */

export type PreviewView = 'home' | 'grid'

export const isHttps = (value: string) => /^https:\/\/\S+$/.test(value.trim())

/** The real /promo page in a phone-sized frame, rendered from the unsaved draft. */
export function PreviewFrame({
  src,
  view,
  onView,
}: {
  src: string | null
  view: PreviewView
  onView: (view: PreviewView) => void
}) {
  return (
    <div className="mt-6 lg:sticky lg:top-4 lg:mt-0 lg:flex-1">
      <div className="mx-auto flex max-w-[400px] items-center justify-between gap-2 pb-2">
        <span className="text-sm font-medium text-gray-700">ตัวอย่างสด (ยังไม่บันทึก)</span>
        <div className="flex gap-1">
          <Button size="sm" variant={view === 'home' ? 'default' : 'outline'} onClick={() => onView('home')}>
            หน้าแรก
          </Button>
          <Button size="sm" variant={view === 'grid' ? 'default' : 'outline'} onClick={() => onView('grid')}>
            หน้าหมวด
          </Button>
        </div>
      </div>
      <div className="mx-auto w-full max-w-[400px] overflow-hidden rounded-[28px] border-[6px] border-gray-900 bg-white shadow-xl">
        {src ? (
          <iframe key={src} src={src} title="ตัวอย่างหน้า /promo" className="block h-[78vh] w-full" />
        ) : (
          <div className="flex h-[78vh] items-center justify-center text-sm text-gray-400">
            กำลังสร้างตัวอย่าง...
          </div>
        )}
      </div>
    </div>
  )
}

export function SortableList({
  id,
  ids,
  onMove,
  children,
}: {
  id: string
  ids: string[]
  onMove: (from: number, to: number) => void
  children: ReactNode
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    onMove(ids.indexOf(String(active.id)), ids.indexOf(String(over.id)))
  }
  return (
    <DndContext id={id} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">{children}</div>
      </SortableContext>
    </DndContext>
  )
}

export function SortableRow({
  id,
  thumb,
  children,
  onRemove,
  removeLabel,
}: {
  id: string
  thumb: ReactNode
  children: ReactNode
  onRemove?: () => void
  removeLabel?: string
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex items-start gap-2 rounded-lg border bg-white p-2',
        isDragging && 'opacity-60 shadow-lg'
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="ลากเพื่อจัดลำดับ"
        className="flex shrink-0 cursor-grab touch-none items-center justify-center self-center text-gray-400 hover:text-gray-600"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      {thumb}
      <div className="min-w-0 flex-1 space-y-1">{children}</div>
      {onRemove && (
        <Button type="button" variant="ghost" size="icon" aria-label={removeLabel} onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}

export function Thumb({ src }: { src: string }) {
  if (!isHttps(src)) return <div className="h-10 w-16 shrink-0 rounded bg-gray-100" aria-hidden="true" />
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className="h-10 w-16 shrink-0 rounded bg-gray-100 object-cover" />
}
