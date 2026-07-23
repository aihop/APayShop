<template>
  <UModal
    v-model:open="modalOpen"
    fullscreen
    :ui="{
      overlay: 'bg-black/60 backdrop-blur-[2px]',
      content: 'border-0 bg-transparent shadow-none ring-0 rounded-none overflow-visible',
    }"
  >
    <template #content>
      <div
        ref="viewportRef"
        class="relative h-dvh w-full select-none overflow-hidden"
        @wheel.prevent="handleWheel"
        @pointermove="handlePointerMove"
        @pointerup="stopDrag"
        @pointercancel="stopDrag"
      >
        <!-- Centering layer: definite size (inset-0), so the image is always laid out from the exact center -->
        <div class="absolute inset-0 flex items-center justify-center p-2">
          <!-- Stage: shrink-wraps the image; pan/zoom/rotate all happen here so
               anything anchored inside (the close button) travels with the image -->
          <div
            v-if="currentImage?.url"
            class="relative max-w-full"
            :class="isDragging ? '' : 'transition-transform duration-150 ease-out'"
            :style="stageTransformStyle"
          >
            <img
              ref="imageRef"
              :src="currentImage.url"
              :alt="currentImage.title || currentImage.caption || mergedLabels.previewImage"
              draggable="false"
              class="block max-w-full touch-none object-contain"
              :class="isDragging ? 'cursor-grabbing' : 'cursor-grab'"
              :style="{ maxHeight: 'calc(100dvh - 1rem)' }"
              @dblclick="handleImageDoubleClick"
              @pointerdown="handlePointerDown"
              @dragstart.prevent
            >

            <UButton
              color="neutral"
              variant="ghost"
              icon="ph:x"
              :title="mergedLabels.close"
              :aria-label="mergedLabels.close"
              class="absolute right-3 top-3 z-20 border border-white/10 bg-black/30 text-white backdrop-blur-md hover:bg-black/50"
              :style="closeButtonStyle"
              @click="emit('update:open', false)"
            />
          </div>
        </div>

        <!-- Chrome anchored to the viewport: arrows, counter, toolbar stay put while the image moves -->
        <template v-if="images.length > 1">
          <UButton
            color="neutral"
            variant="ghost"
            icon="ph:caret-left-bold"
            :title="mergedLabels.previous"
            :aria-label="mergedLabels.previous"
            class="absolute left-4 top-1/2 z-20 -translate-y-1/2 rounded-full border border-white/10 bg-black/30 text-white backdrop-blur-md hover:bg-black/50"
            :disabled="currentIndex <= 0"
            @click="goPrev"
          />
          <UButton
            color="neutral"
            variant="ghost"
            icon="ph:caret-right-bold"
            :title="mergedLabels.next"
            :aria-label="mergedLabels.next"
            class="absolute right-4 top-1/2 z-20 -translate-y-1/2 rounded-full border border-white/10 bg-black/30 text-white backdrop-blur-md hover:bg-black/50"
            :disabled="currentIndex >= images.length - 1"
            @click="goNext"
          />
          <div
            class="pointer-events-none absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-full bg-black/30 px-3 py-1 text-xs text-white/90 backdrop-blur-md"
          >
            {{ currentIndex + 1 }} / {{ images.length }}
          </div>
        </template>

        <div
          v-if="currentImage?.url"
          class="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-0.5 rounded-full border border-white/10 bg-black/40 px-2 py-1.5 text-white backdrop-blur-md"
        >
          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            icon="ph:magnifying-glass-minus"
            :title="mergedLabels.zoomOut"
            :aria-label="mergedLabels.zoomOut"
            :disabled="zoomScale <= MIN_SCALE"
            class="text-white hover:bg-white/10"
            @click="zoomOut"
          />
          <span class="w-11 text-center text-xs tabular-nums text-white/80">{{ zoomPercentage }}%</span>
          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            icon="ph:magnifying-glass-plus"
            :title="mergedLabels.zoomIn"
            :aria-label="mergedLabels.zoomIn"
            :disabled="zoomScale >= MAX_SCALE"
            class="text-white hover:bg-white/10"
            @click="zoomIn"
          />
          <div class="mx-1 h-4 w-px bg-white/15" />
          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            icon="ph:arrow-counter-clockwise"
            :title="mergedLabels.rotateLeft"
            :aria-label="mergedLabels.rotateLeft"
            class="text-white hover:bg-white/10"
            @click="rotateLeft"
          />
          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            icon="ph:arrow-clockwise"
            :title="mergedLabels.rotateRight"
            :aria-label="mergedLabels.rotateRight"
            class="text-white hover:bg-white/10"
            @click="rotateRight"
          />
          <div class="mx-1 h-4 w-px bg-white/15" />
          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            icon="ph:arrows-in-simple"
            :title="mergedLabels.fitScreen"
            :aria-label="mergedLabels.fitScreen"
            class="text-white hover:bg-white/10"
            @click="resetView"
          />
          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            icon="ph:frame-corners"
            :title="mergedLabels.actualSize"
            :aria-label="mergedLabels.actualSize"
            class="text-white hover:bg-white/10"
            @click="setActualSize"
          />
          <template v-if="downloadable">
            <div class="mx-1 h-4 w-px bg-white/15" />
            <UButton
              color="neutral"
              variant="ghost"
              size="sm"
              icon="ph:download-simple"
              :title="mergedLabels.downloadImage"
              :aria-label="mergedLabels.downloadImage"
              :loading="downloadLoading"
              class="text-white hover:bg-white/10"
              @click="downloadCurrentImage"
            />
          </template>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import type { ImageGalleryItem, ImageGalleryLabels } from './image-gallery.types'

const props = withDefaults(defineProps<{
  open: boolean
  images: ImageGalleryItem[]
  currentIndex: number
  labels?: Partial<ImageGalleryLabels>
  downloadable?: boolean
}>(), {
  labels: () => ({}),
  downloadable: true,
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  'update:currentIndex': [value: number]
}>()

const toast = useToast()

const MIN_SCALE = 0.25
const MAX_SCALE = 4
const SCALE_STEP = 0.25

const defaultLabels: Required<ImageGalleryLabels> = {
  previewImage: 'Preview',
  actualSize: '1:1',
  fitScreen: 'Fit',
  downloadImage: 'Download',
  downloadFallback: 'Opened the image in a new tab so you can save it there',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  rotateLeft: 'Rotate left',
  rotateRight: 'Rotate right',
  close: 'Close',
  previous: 'Previous',
  next: 'Next',
}

const mergedLabels = computed<Required<ImageGalleryLabels>>(() => ({
  ...defaultLabels,
  ...(props.labels || {}),
}))

const modalOpen = computed({
  get: () => props.open,
  set: value => emit('update:open', value),
})

const currentImage = computed(() => props.images[props.currentIndex] || null)

// ── View state ────────────────────────────────────────────────
const viewportRef = ref<HTMLElement | null>(null)
const imageRef = ref<HTMLImageElement | null>(null)
const zoomScale = ref(1)
const rotateDeg = ref(0)
const offsetX = ref(0)
const offsetY = ref(0)
const isDragging = ref(false)
const downloadLoading = ref(false)

const dragStart = { x: 0, y: 0, originX: 0, originY: 0, pointerId: null as number | null }

const zoomPercentage = computed(() => Math.round(zoomScale.value * 100))

const stageTransformStyle = computed(() => ({
  transform: `translate(${offsetX.value}px, ${offsetY.value}px) scale(${zoomScale.value}) rotate(${rotateDeg.value}deg)`,
}))

// Cancels the stage's scale/rotate so the close button keeps a constant
// size and orientation while staying pinned to the image corner.
const closeButtonStyle = computed(() => ({
  transform: `rotate(${-rotateDeg.value}deg) scale(${1 / zoomScale.value})`,
  transformOrigin: 'top right',
}))

// ── Navigation ────────────────────────────────────────────────
const setIndex = (index: number) => {
  if (index < 0 || index >= props.images.length) return
  emit('update:currentIndex', index)
}
const goPrev = () => setIndex(props.currentIndex - 1)
const goNext = () => setIndex(props.currentIndex + 1)

// ── Zoom / rotate ─────────────────────────────────────────────
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const applyScale = (nextScale: number) => {
  zoomScale.value = clamp(Number(nextScale.toFixed(2)), MIN_SCALE, MAX_SCALE)
}
const zoomIn = () => applyScale(zoomScale.value + SCALE_STEP)
const zoomOut = () => applyScale(zoomScale.value - SCALE_STEP)

const rotateLeft = () => { rotateDeg.value -= 90 }
const rotateRight = () => { rotateDeg.value += 90 }

const resetView = () => {
  zoomScale.value = 1
  rotateDeg.value = 0
  offsetX.value = 0
  offsetY.value = 0
  isDragging.value = false
  dragStart.pointerId = null
}

const setActualSize = () => {
  const image = imageRef.value
  const renderedWidth = image?.clientWidth || 0
  const naturalWidth = image?.naturalWidth || 0
  if (!renderedWidth || !naturalWidth) {
    applyScale(2)
    return
  }
  applyScale(naturalWidth / renderedWidth)
}

const setActualSizeAtPoint = (event: MouseEvent) => {
  const image = imageRef.value
  const renderedWidth = image?.clientWidth || 0
  const naturalWidth = image?.naturalWidth || 0
  if (!image || !renderedWidth || !naturalWidth) {
    setActualSize()
    return
  }
  const targetScale = clamp(naturalWidth / renderedWidth, MIN_SCALE, MAX_SCALE)
  const rect = image.getBoundingClientRect()
  const dx = event.clientX - (rect.left + rect.width / 2)
  const dy = event.clientY - (rect.top + rect.height / 2)
  zoomScale.value = targetScale
  offsetX.value = -dx * (targetScale - 1)
  offsetY.value = -dy * (targetScale - 1)
}

const handleImageDoubleClick = (event: MouseEvent) => {
  if (zoomScale.value !== 1 || rotateDeg.value !== 0 || offsetX.value || offsetY.value) {
    resetView()
    return
  }
  setActualSizeAtPoint(event)
}

const handleWheel = (event: WheelEvent) => {
  if (!currentImage.value) return
  if (event.deltaY < 0) zoomIn()
  else zoomOut()
}

// ── Drag to pan (any zoom level, naive-ui style free drag) ────
const handlePointerDown = (event: PointerEvent) => {
  if (event.button !== 0) return
  event.preventDefault()
  isDragging.value = true
  dragStart.x = event.clientX
  dragStart.y = event.clientY
  dragStart.originX = offsetX.value
  dragStart.originY = offsetY.value
  dragStart.pointerId = event.pointerId
  imageRef.value?.setPointerCapture?.(event.pointerId)
}

const handlePointerMove = (event: PointerEvent) => {
  if (!isDragging.value) return
  offsetX.value = dragStart.originX + (event.clientX - dragStart.x)
  offsetY.value = dragStart.originY + (event.clientY - dragStart.y)
}

const stopDrag = (event?: PointerEvent) => {
  const pointerId = event?.pointerId ?? dragStart.pointerId
  if (pointerId != null && imageRef.value?.hasPointerCapture?.(pointerId)) {
    imageRef.value.releasePointerCapture(pointerId)
  }
  dragStart.pointerId = null
  isDragging.value = false
}

// ── Keyboard ──────────────────────────────────────────────────
const handleKeydown = (event: KeyboardEvent) => {
  if (!props.open) return
  if ((event.key === '+' || event.key === '=') && !event.metaKey) {
    event.preventDefault()
    zoomIn()
  }
  else if (event.key === '-' && !event.metaKey) {
    event.preventDefault()
    zoomOut()
  }
  else if (event.key === '0') {
    event.preventDefault()
    resetView()
  }
  else if (event.key === 'ArrowLeft') {
    event.preventDefault()
    goPrev()
  }
  else if (event.key === 'ArrowRight') {
    event.preventDefault()
    goNext()
  }
}

// ── Download ──────────────────────────────────────────────────
const getDownloadFilename = () => {
  const source = currentImage.value
  if (!source) return 'image.jpg'
  if (source.downloadName) return source.downloadName
  const safeTitle = (source.title || 'image')
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'image'
  return `${safeTitle}-${props.currentIndex + 1}.jpg`
}

const downloadCurrentImage = async () => {
  const source = currentImage.value
  if (!props.downloadable || !source?.url || downloadLoading.value) return
  downloadLoading.value = true
  try {
    const res = await fetch(source.url)
    if (!res.ok) throw new Error('download_failed')
    const blob = await res.blob()
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = getDownloadFilename()
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(objectUrl)
  }
  catch {
    window.open(source.url, '_blank', 'noopener,noreferrer')
    toast.add({
      title: mergedLabels.value.downloadFallback,
      color: 'warning',
    })
  }
  finally {
    downloadLoading.value = false
  }
}

// ── Lifecycle ─────────────────────────────────────────────────
watch(() => props.open, (value) => {
  if (typeof window === 'undefined') return
  if (value) {
    resetView()
    window.addEventListener('keydown', handleKeydown)
    return
  }
  window.removeEventListener('keydown', handleKeydown)
})

watch(() => [props.images.length, props.currentIndex] as const, ([length, index]) => {
  if (!length) return
  if (index < 0) setIndex(0)
  else if (index >= length) setIndex(length - 1)
  resetView()
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', handleKeydown)
  }
})
</script>
