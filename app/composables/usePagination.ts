import { ref } from 'vue'

export function usePagination(defaultPageSize = 15) {
  const page = ref(1)
  const pageSize = ref(defaultPageSize)

 
  const onPageChange = async (val: number | (() => Promise<void> | void), refreshCallback?: () => Promise<void> | void) => {
    if (typeof val === 'number') {
      page.value = val
      if (refreshCallback) {
        await refreshCallback()
      }
    } else if (typeof val === 'function') {
      await val()
    }
  }
  return {
    page,
    pageSize,
    onPageChange
  }
}
