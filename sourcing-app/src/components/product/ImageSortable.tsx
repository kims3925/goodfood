'use client'

import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Star, ImageIcon, Trash2 } from 'lucide-react'
import ConfirmModal from '@/components/ui/ConfirmModal'

export interface SortableImage {
  id: number
  imageUrl: string
  name?: string
  sortOrder: number
}

interface SortableImageItemProps {
  image: SortableImage
  index: number
  onRequestDelete?: (imageId: number) => void
  isDeleting?: boolean
}

function SortableImageItem({ image, index, onRequestDelete, isDeleting }: SortableImageItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: image.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group rounded-lg overflow-hidden border-2 ${
        isDragging
          ? 'border-purple-500 shadow-lg z-50 opacity-90'
          : 'border-gray-200 hover:border-purple-300'
      } ${index === 0 ? 'ring-2 ring-purple-500 ring-offset-2' : ''}`}
    >
      {/* Thumbnail indicator */}
      {index === 0 && (
        <div className="absolute top-2 left-2 z-10 flex items-center gap-1 px-2 py-1 bg-purple-600 text-white text-xs rounded-full shadow">
          <Star size={12} fill="currentColor" />
          <span>대표</span>
        </div>
      )}

      {/* Order number */}
      <div className="absolute top-2 right-2 z-10 w-6 h-6 flex items-center justify-center bg-black/60 text-white text-xs font-bold rounded-full">
        {index + 1}
      </div>

      {/* Delete button */}
      {onRequestDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            if (!isDeleting) {
              onRequestDelete(image.id)
            }
          }}
          disabled={isDeleting}
          className="absolute top-2 left-2 z-10 p-1.5 bg-red-500 hover:bg-red-600 rounded-lg shadow cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
          title="이미지 삭제"
          style={{ left: index === 0 ? '70px' : '8px' }}
        >
          {isDeleting ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Trash2 size={14} className="text-white" />
          )}
        </button>
      )}

      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute bottom-2 right-2 z-10 p-1.5 bg-white/90 rounded-lg shadow cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
        title="드래그하여 순서 변경"
      >
        <GripVertical size={16} className="text-gray-600" />
      </div>

      {/* Image */}
      <div className="aspect-square bg-gray-100">
        <img
          src={image.imageUrl}
          alt={image.name || `이미지 ${index + 1}`}
          className="w-full h-full object-cover"
          draggable={false}
        />
      </div>
    </div>
  )
}

interface ImageSortableProps {
  images: SortableImage[]
  onReorder: (newOrder: SortableImage[]) => void
  onDelete?: (imageId: number) => void
  deletingImageId?: number | null
  disabled?: boolean
}

export default function ImageSortable({
  images,
  onReorder,
  onDelete,
  deletingImageId,
  disabled = false,
}: ImageSortableProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null)

  const handleRequestDelete = (imageId: number) => {
    setPendingDeleteId(imageId)
    setShowDeleteConfirm(true)
  }

  const confirmDelete = () => {
    if (pendingDeleteId !== null && onDelete) {
      onDelete(pendingDeleteId)
    }
    setShowDeleteConfirm(false)
    setPendingDeleteId(null)
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = images.findIndex((img) => img.id === active.id)
      const newIndex = images.findIndex((img) => img.id === over.id)

      const newOrder = arrayMove(images, oldIndex, newIndex).map(
        (img, index) => ({
          ...img,
          sortOrder: index,
        })
      )

      onReorder(newOrder)
    }
  }

  if (images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-400">
        <ImageIcon size={48} className="mb-3" />
        <p className="text-sm">이미지가 없습니다</p>
      </div>
    )
  }

  if (disabled) {
    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
        {images.map((image, index) => (
          <div
            key={image.id}
            className={`relative rounded-lg overflow-hidden border-2 border-gray-200 ${
              index === 0 ? 'ring-2 ring-purple-500 ring-offset-2' : ''
            }`}
          >
            {index === 0 && (
              <div className="absolute top-2 left-2 z-10 flex items-center gap-1 px-2 py-1 bg-purple-600 text-white text-xs rounded-full shadow">
                <Star size={12} fill="currentColor" />
                <span>대표</span>
              </div>
            )}
            <div className="absolute top-2 right-2 z-10 w-6 h-6 flex items-center justify-center bg-black/60 text-white text-xs font-bold rounded-full">
              {index + 1}
            </div>
            <div className="aspect-square bg-gray-100">
              <img
                src={image.imageUrl}
                alt={image.name || `이미지 ${index + 1}`}
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={images.map((img) => img.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {images.map((image, index) => (
              <SortableImageItem
                key={image.id}
                image={image}
                index={index}
                onRequestDelete={onDelete ? handleRequestDelete : undefined}
                isDeleting={deletingImageId === image.id}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false)
          setPendingDeleteId(null)
        }}
        onConfirm={confirmDelete}
        title="이미지 삭제"
        message="이 이미지를 삭제하시겠습니까?"
        confirmText="삭제"
        variant="danger"
      />
    </>
  )
}
