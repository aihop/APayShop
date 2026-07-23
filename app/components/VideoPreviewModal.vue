<template>
  <UModal
    v-model:open="modalOpen"
    :ui="{
      overlay: 'bg-black/20 backdrop-blur-[3px]',
      content: 'max-w-6xl border-0 bg-transparent shadow-none ring-0 overflow-visible',
    }"
  >
    <template #content>
      <div class="flex max-h-[calc(100vh-1.5rem)] flex-col p-2 sm:max-h-[calc(100vh-2rem)] sm:p-4">
        <div class="mb-3 flex shrink-0 items-start justify-between gap-4 rounded-2xl border border-white/10 bg-white/8 px-4 py-3 backdrop-blur-xl">
          <div class="min-w-0 text-white">
            <div class="flex items-center gap-2">
              <h3 class="text-sm font-semibold">{{ currentVideo?.title || mergedLabels.previewVideo }}</h3>
              <UBadge v-if="videos.length > 1" color="neutral" variant="subtle" size="sm">
                {{ currentIndex + 1 }} / {{ videos.length }}
              </UBadge>
            </div>
            <p v-if="currentVideo?.caption" class="mt-1 text-xs text-white/70">
              {{ currentVideo.caption }}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <UButton
              v-if="downloadable"
              color="neutral"
              variant="solid"
              size="xs"
              icon="ph:download-simple"
              :loading="downloadLoading"
              @click="downloadCurrentVideo"
            >
              {{ mergedLabels.downloadVideo }}
            </UButton>
            <UButton color="neutral" variant="ghost" icon="ph:x" @click="emit('update:open', false)" />
          </div>
        </div>

        <div class="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/10 bg-black/60 shadow-2xl backdrop-blur-sm">
          <div class="flex h-full items-center justify-center p-4">
            <video
              v-if="currentVideo?.url"
              ref="videoRef"
              :key="currentVideo.id"
              :src="currentVideo.url"
              controls
              autoplay
              playsinline
              class="max-h-full max-w-full rounded-xl bg-black"
            />
          </div>
          <template v-if="videos.length > 1">
            <UButton
              color="neutral"
              variant="solid"
              icon="ph:caret-left-bold"
              class="absolute left-3 top-1/2 -translate-y-1/2 border border-white/15 bg-white/10 backdrop-blur"
              :disabled="currentIndex <= 0"
              @click="goPrev"
            />
            <UButton
              color="neutral"
              variant="solid"
              icon="ph:caret-right-bold"
              class="absolute right-3 top-1/2 -translate-y-1/2 border border-white/15 bg-white/10 backdrop-blur"
              :disabled="currentIndex >= videos.length - 1"
              @click="goNext"
            />
          </template>
        </div>

        <div
          v-if="videos.length > 1"
          class="mt-3 grid max-h-28 shrink-0 grid-cols-1 gap-2 overflow-y-auto rounded-2xl border border-white/10 bg-white/6 p-2 backdrop-blur-xl sm:grid-cols-2"
        >
          <button
            v-for="(video, index) in videos"
            :key="video.id"
            type="button"
            class="flex items-center gap-3 rounded-xl border px-3 py-2 text-left transition"
            :class="index === currentIndex
              ? 'border-primary bg-primary/12 ring-1 ring-primary/60'
              : 'border-white/10 bg-white/5 hover:bg-white/10'"
            @click="setIndex(index)"
          >
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-black/50 text-white/80">
              <UIcon name="ph:play-fill" class="h-5 w-5" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="truncate text-xs font-medium text-white">
                {{ video.title || `${mergedLabels.previewVideo} ${index + 1}` }}
              </div>
              <div v-if="video.caption" class="mt-0.5 truncate text-[11px] text-white/60">
                {{ video.caption }}
              </div>
            </div>
          </button>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { VideoPreviewItem, VideoPreviewLabels } from './video-preview.types'

const props = withDefaults(defineProps<{
  open: boolean
  videos: VideoPreviewItem[]
  currentIndex: number
  labels?: Partial<VideoPreviewLabels>
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
const videoRef = ref<HTMLVideoElement | null>(null)
const downloadLoading = ref(false)

const defaultLabels: VideoPreviewLabels = {
  previewVideo: 'Video',
  downloadVideo: 'Download',
  downloadFallback: 'Opened the video in a new tab so you can save it there',
}

const mergedLabels = computed<VideoPreviewLabels>(() => ({
  ...defaultLabels,
  ...(props.labels || {}),
}))

const modalOpen = computed({
  get: () => props.open,
  set: value => emit('update:open', value),
})

const currentVideo = computed(() => props.videos[props.currentIndex] || null)

const setIndex = (index: number) => {
  if (index < 0 || index >= props.videos.length) return
  emit('update:currentIndex', index)
}

const goPrev = () => setIndex(props.currentIndex - 1)
const goNext = () => setIndex(props.currentIndex + 1)

const getDownloadFilename = () => {
  const source = currentVideo.value
  if (!source) return 'video.mp4'
  if (source.downloadName) return source.downloadName
  const safeTitle = (source.title || 'video')
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'video'
  return `${safeTitle}-${props.currentIndex + 1}.mp4`
}

const downloadCurrentVideo = async () => {
  const source = currentVideo.value
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

const handleKeydown = (event: KeyboardEvent) => {
  if (!props.open) return
  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    goPrev()
  }
  else if (event.key === 'ArrowRight') {
    event.preventDefault()
    goNext()
  }
}

watch(() => props.open, (value) => {
  if (typeof window === 'undefined') return
  if (value) {
    window.addEventListener('keydown', handleKeydown)
    return
  }
  window.removeEventListener('keydown', handleKeydown)
})

watch(() => props.currentIndex, () => {
  if (videoRef.value) {
    videoRef.value.currentTime = 0
  }
})
</script>
