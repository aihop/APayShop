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

  /**
   * 删除数据后的分页自愈刷新处理：
   * 若当前页被删空（剩余 1 条且处于第 2 页及以上），自动前退一页；
   * 否则正常触发刷新。
   */
  const refreshAfterDelete = async (currentListLength: number, refreshCallback?: () => Promise<void> | void) => {
    if (currentListLength <= 1 && page.value > 1) {
      page.value--
    } else if (refreshCallback) {
      await refreshCallback()
    }
  }

  /**
   * 自动越界保护校验：
   * 当总条数大于 0 但当前页列表为空且页码大于 1 时，自动校正页码至有效末页。
   */
  const clampPage = (total: number, currentListLength: number) => {
    if (total > 0 && currentListLength === 0 && page.value > 1) {
      const maxPage = Math.max(1, Math.ceil(total / pageSize.value))
      if (page.value > maxPage) {
        page.value = maxPage
        return true
      }
    }
    return false
  }

  return {
    page,
    pageSize,
    onPageChange,
    refreshAfterDelete,
    clampPage,
  }
}
