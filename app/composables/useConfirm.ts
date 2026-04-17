import { ref } from 'vue'

const isOpen = ref(false)
const title = ref('')
const description = ref('')
const resolvePromise = ref<((value: boolean) => void) | null>(null)

export const useConfirm = () => {
  const confirm = (opts: { title?: string; description?: string }) => {
    title.value = opts.title || 'Confirm'
    description.value = opts.description || 'Are you sure you want to proceed?'
    isOpen.value = true
    
    return new Promise<boolean>((resolve) => {
      resolvePromise.value = resolve
    })
  }

  const accept = () => {
    isOpen.value = false
    if (resolvePromise.value) {
      resolvePromise.value(true)
      resolvePromise.value = null
    }
  }

  const cancel = () => {
    isOpen.value = false
    if (resolvePromise.value) {
      resolvePromise.value(false)
      resolvePromise.value = null
    }
  }

  return {
    isOpen,
    title,
    description,
    confirm,
    accept,
    cancel
  }
}
