import { ref } from 'vue'

export function usePagination(defaultPageSize = 15) {
  const page = ref(1)
  const pageSize = ref(defaultPageSize)

 
  const onPageChange = async (val: number, refreshCallback?: () => Promise<void> | void) => {
    page.value = val
    if (refreshCallback) {
      await refreshCallback()
    }
  }
  return {
    page,
    pageSize,
    onPageChange
  }
}
