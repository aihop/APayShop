<template>
  <UModal
    v-model:open="isOpen"
    :ui="{
      overlay: 'bg-black/50 dark:bg-black/75 backdrop-blur-sm',
      content: 'bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/10 rounded-3xl shadow-2xl dark:shadow-[0_25px_60px_rgba(0,0,0,0.8)] overflow-hidden w-full max-w-[380px]',
    }"
  >
    <template #content>
      <div class="p-6 text-gray-900 dark:text-white w-full max-w-[380px] mx-auto select-none">
        <!-- 头部标题与控制按钮 -->
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <UIcon name="ph:shield-check-bold" class="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
            <h3 class="text-base font-semibold tracking-tight text-gray-900 dark:text-white">
              {{ isZh ? '安全验证' : 'Security Verification' }}
            </h3>
          </div>
          <div class="flex items-center gap-1">
            <button
              type="button"
              class="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/10 transition-colors"
              :title="isZh ? '刷新验证码' : 'Refresh captcha'"
              :disabled="status === 'loading'"
              @click="fetchCaptcha"
            >
              <UIcon name="ph:arrows-clockwise-bold" class="w-4 h-4" :class="{ 'animate-spin': status === 'loading' }" />
            </button>
            <button
              type="button"
              class="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/10 transition-colors"
              :title="isZh ? '关闭' : 'Close'"
              @click="close"
            >
              <UIcon name="ph:x-bold" class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- 提示文本 -->
        <p class="text-xs text-gray-500 dark:text-gray-400 mb-4">
          {{ isZh ? '拖动下方滑块，将拼图完整嵌入缺口' : 'Drag the slider to fit the piece into the slot' }}
        </p>

        <!-- 拼图大图区域 -->
        <div
          ref="containerRef"
          class="relative w-[330px] h-[155px] mx-auto mb-4 bg-gray-100 dark:bg-zinc-900 rounded-xl overflow-hidden border border-gray-200 dark:border-white/10 shadow-inner"
        >
          <!-- 背景图（含缺口槽） -->
          <img
            v-if="imgBackSrc"
            :src="imgBackSrc"
            class="w-full h-full object-cover block pointer-events-none"
            alt="captcha-bg"
          />

          <!-- 拼图移动切片 -->
          <img
            v-if="imgPieceSrc"
            :src="imgPieceSrc"
            class="absolute z-20 pointer-events-none drop-shadow-[0_4px_10px_rgba(0,0,0,0.85)]"
            :style="{
              top: `${pieceTop}px`,
              left: 0,
              transform: `translateX(${moveBlockLeft}px)`,
              width: '52px',
              height: '52px',
            }"
            alt="captcha-piece"
          />

          <!-- 遮罩加载中状态 -->
          <div
            v-if="status === 'loading'"
            class="absolute inset-0 bg-white/80 dark:bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-2 z-30"
          >
            <UIcon name="ph:spinner-gap-bold" class="w-6 h-6 text-gray-800 dark:text-white animate-spin" />
            <span class="text-xs text-gray-600 dark:text-gray-300 font-medium">{{ isZh ? '正在加载安全凭据...' : 'Loading challenge...' }}</span>
          </div>

          <!-- 成功对齐状态覆盖 -->
          <div
            v-if="status === 'success'"
            class="absolute inset-0 bg-emerald-600/90 dark:bg-emerald-950/85 backdrop-blur-sm flex items-center justify-center gap-2 z-30 transition-all duration-300"
          >
            <UIcon name="ph:check-circle-fill" class="w-7 h-7 text-white dark:text-emerald-400" />
            <span class="text-sm font-medium text-white dark:text-emerald-200">{{ isZh ? '验证通过' : 'Verification Passed' }}</span>
          </div>
        </div>

        <!-- 滑块轨道区域 -->
        <div
          class="relative h-[44px] bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl max-w-[330px] mx-auto w-full overflow-hidden flex items-center"
        >
          <!-- 滑动高亮进度条 -->
          <div
            class="absolute left-0 top-0 bottom-0 bg-emerald-500/15 dark:bg-white/15 pointer-events-none transition-all duration-75"
            :style="{ width: `${moveBlockLeft + 26}px` }"
          />

          <!-- 滑块按钮 -->
          <div
            class="absolute left-0 top-0 bottom-0 w-[52px] bg-white dark:bg-zinc-800 text-gray-700 dark:text-white border border-gray-200/80 dark:border-white/15 rounded-xl cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md dark:shadow-lg flex items-center justify-center touch-none select-none transition-transform duration-75 z-10 hover:bg-gray-50 dark:hover:bg-zinc-700 active:scale-[0.98]"
            :style="{ transform: `translateX(${moveBlockLeft}px)` }"
            @mousedown="startDrag"
            @touchstart="startDrag"
          >
            <UIcon name="ph:arrows-left-right-bold" class="w-5 h-5 pointer-events-none text-gray-600 dark:text-gray-200" />
          </div>

          <!-- 轨道居中文本提示 -->
          <div class="absolute inset-0 flex items-center justify-center pointer-events-none text-xs text-gray-500 dark:text-gray-400 tracking-wider font-medium">
            <span v-if="status === 'verifying'" class="flex items-center gap-1.5 text-gray-800 dark:text-white">
              <UIcon name="ph:spinner-gap-bold" class="w-3.5 h-3.5 animate-spin text-gray-600 dark:text-gray-300" />
              {{ isZh ? '正在校验...' : 'Verifying...' }}
            </span>
            <span v-else-if="status === 'error'" class="text-rose-500 dark:text-rose-400">
              {{ errorMsg || (isZh ? '位置未对齐，请重试' : 'Position mismatch, retry') }}
            </span>
            <span v-else>
              {{ isZh ? '按住滑块并拖动' : 'Drag slider to match' }}
            </span>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
const emit = defineEmits<{
  success: [ticket: string]
  close: []
}>()

const isOpen = ref(false)
const status = ref<'idle' | 'loading' | 'verifying' | 'success' | 'error'>('idle')
const token = ref('')
const imgBackSrc = ref('')
const imgPieceSrc = ref('')
const pieceTop = ref(0)
const moveBlockLeft = ref(0)
const errorMsg = ref('')
const containerRef = ref<HTMLElement | null>(null)

const { locale } = useI18n()
const isZh = computed(() => (locale.value || '').startsWith('zh'))

let isDragging = false
let startX = 0
let startLeft = 0
let scaleRatio = 1

function show() {
  isOpen.value = true
  fetchCaptcha()
}

function close() {
  isOpen.value = false
  emit('close')
}

watch(isOpen, (val) => {
  if (!val) {
    emit('close')
  }
})

async function fetchCaptcha() {
  status.value = 'loading'
  moveBlockLeft.value = 0
  errorMsg.value = ''

  try {
    const res = await $fetch<{
      success: boolean
      data: {
        token: string
        bg: string
        pieceImg: string
        pieceY: number
      }
    }>('/api/auth/captcha/get')

    if (res?.success && res.data) {
      token.value = res.data.token
      imgBackSrc.value = res.data.bg
      imgPieceSrc.value = res.data.pieceImg
      pieceTop.value = res.data.pieceY
      status.value = 'idle'
    } else {
      throw new Error(isZh.value ? '获取验证码失败' : 'Failed to fetch captcha')
    }
  } catch (err: any) {
    status.value = 'error'
    errorMsg.value = err.data?.message || err.message || (isZh.value ? '加载失败，请刷新' : 'Load failed')
  }
}

function getClientX(evt: MouseEvent | TouchEvent): number {
  if ('touches' in evt && evt.touches.length > 0) {
    return evt.touches[0].clientX
  }
  return (evt as MouseEvent).clientX
}

function startDrag(e: MouseEvent | TouchEvent) {
  if (status.value === 'loading' || status.value === 'verifying' || status.value === 'success') {
    return
  }

  isDragging = true
  startX = getClientX(e)
  startLeft = moveBlockLeft.value

  if (containerRef.value) {
    const rect = containerRef.value.getBoundingClientRect()
    scaleRatio = rect.width > 0 ? rect.width / 330 : 1
  }

  const onMove = (evt: MouseEvent | TouchEvent) => {
    if (!isDragging) return
    const currentX = getClientX(evt)
    const delta = (currentX - startX) / scaleRatio
    // 最大滑动距离 330 - 44 = 286
    const nextLeft = Math.max(0, Math.min(startLeft + delta, 278))
    moveBlockLeft.value = nextLeft
  }

  const onEnd = async () => {
    if (!isDragging) return
    isDragging = false

    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onEnd)
    window.removeEventListener('touchmove', onMove)
    window.removeEventListener('touchend', onEnd)

    await submitVerify()
  }

  if (e.type === 'mousedown') {
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onEnd)
  } else {
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onEnd)
  }
}

async function submitVerify() {
  status.value = 'verifying'
  try {
    const res = await $fetch<{ success: boolean; ticket: string }>('/api/auth/captcha/check', {
      method: 'POST',
      body: {
        token: token.value,
        moveX: Math.round(moveBlockLeft.value),
      },
    })

    if (res?.success && res.ticket) {
      status.value = 'success'
      setTimeout(() => {
        emit('success', res.ticket)
        close()
      }, 400)
    } else {
      throw new Error(isZh.value ? '验证失败' : 'Verification failed')
    }
  } catch (err: any) {
    status.value = 'error'
    errorMsg.value = err.data?.message || err.message || (isZh.value ? '未对齐，请重试' : 'Position mismatch')
    setTimeout(() => {
      fetchCaptcha()
    }, 700)
  }
}

defineExpose({
  show,
  close,
  fetchCaptcha,
})
</script>
