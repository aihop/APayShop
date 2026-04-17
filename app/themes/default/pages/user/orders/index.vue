<template>
  <div class="min-h-screen bg-[#050505] pt-32 pb-20 px-6">
    <div class="max-w-5xl mx-auto">
      <!-- Header -->
      <div class="flex items-center justify-between mb-10">
        <div>
          <h1 class="text-3xl font-bold text-white mb-2">{{ $t('site.order.myOrders') }}</h1>
          <p class="text-gray-400">{{ $t('site.order.myOrdersTips') }}</p>
        </div>
        <div class="flex items-center gap-3 bg-white/5 border border-white/10 rounded-full px-4 py-2">
          <UIcon
            name="ph:user-circle"
            class="w-5 h-5 text-purple-400"
          />
          <span class="text-sm font-medium text-gray-200">{{ user?.nickname || user?.email }}</span>
        </div>
      </div>

      <!-- Orders List -->
      <div
        v-if="pending"
        class="space-y-4"
      >
        <div
          v-for="i in 3"
          :key="i"
          class="h-32 bg-[#0A0A0A] border border-white/5 rounded-2xl animate-pulse"
        ></div>
      </div>

      <div
        v-else-if="orders && orders.length > 0"
        class="space-y-6"
      >
        <div
          v-for="order in orders"
          :key="order.id"
          class="bg-[#0A0A0A] border border-white/10 rounded-2xl p-6 transition-colors hover:border-purple-500/30"
        >
          <div class="flex flex-col md:flex-row gap-6">
            <!-- Product Image -->
            <div class="w-full md:w-32 h-24 bg-gray-900 rounded-xl overflow-hidden flex-shrink-0 relative">
              <img
                v-if="order.productImageUrl"
                :src="order.productImageUrl"
                :alt="order.productName"
                class="w-full h-full object-cover"
              />
              <div
                v-else
                class="w-full h-full flex items-center justify-center text-gray-700"
              >
                <UIcon
                  name="ph:image"
                  class="w-8 h-8"
                />
              </div>
              <div class="absolute top-2 left-2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-bold text-white border border-white/10">
                {{ order.productType?.toUpperCase() }}
              </div>
            </div>

            <!-- Order Details -->
            <div class="flex-grow flex flex-col justify-between">
              <div>
                <div class="flex items-start justify-between mb-2">
                  <h3 class="text-lg font-bold text-white">{{ order.productName || 'Unknown Product' }}</h3>
                  <div class="text-right">
                    <span class="text-lg font-bold text-white">${{ order.amount }}</span>
                  </div>
                </div>

                <div class="flex flex-wrap items-center gap-4 text-sm text-gray-400 mb-4">
                  <span class="flex items-center gap-1">
                    <UIcon
                      name="ph:hash"
                      class="w-4 h-4"
                    />
                    {{ order.id.split('-')[0] }}...
                  </span>
                  <span class="flex items-center gap-1">
                    <UIcon
                      name="ph:calendar-blank"
                      class="w-4 h-4"
                    />
                    {{ new Date(order.createdAt).toLocaleDateString() }}
                  </span>
                  <span class="flex items-center gap-1">
                    <UIcon
                      name="ph:credit-card"
                      class="w-4 h-4"
                    />
                    {{ order.payMethod || 'Unknown' }}
                  </span>
                </div>
              </div>

              <!-- Status and Actions -->
              <div class="flex items-center justify-between pt-4 border-t border-white/5">
                <div class="flex items-center gap-2">
                  <UBadge
                    v-if="order.payStatus === 'paid' || order.status === 'delivered'"
                    color="success"
                    variant="subtle"
                    class="font-medium"
                  >
                    <UIcon
                      name="ph:check-circle-fill"
                      class="w-4 h-4 mr-1"
                    />
                    {{ $t('site.payment.completed') }}
                  </UBadge>
                  <UBadge
                    v-else-if="order.payStatus === 'pending'"
                    color="warning"
                    variant="subtle"
                    class="font-medium"
                  >
                    <UIcon
                      name="ph:clock-fill"
                      class="w-4 h-4 mr-1"
                    />
                    {{ $t('site.payment.pendingPayment') }}
                  </UBadge>
                  <UBadge
                    v-else
                    color="error"
                    variant="subtle"
                    class="font-medium"
                  >
                    <UIcon
                      name="ph:x-circle-fill"
                      class="w-4 h-4 mr-1"
                    />
                    {{ order.payStatus }}
                  </UBadge>

                  <UBadge
                    color="primary"
                    variant="soft"
                    class="font-medium capitalize"
                  >
                    <UIcon
                      name="ph:package"
                      class="w-4 h-4 mr-1"
                    />
                    {{ order.status }}
                  </UBadge>
                </div>

                <div class="flex gap-3">
                  <UButton
                    v-if="order.payStatus === 'paid' || order.status === 'delivered'"
                    color="primary"
                    variant="solid"
                    class="bg-purple-600 hover:bg-purple-500 text-white font-medium"
                    :to="`/user/orders/${order.id}`"
                  >
                    {{ $t('site.payment.viewDelivery') }}
                  </UButton>
                  <PaymentModal
                    v-if="order.payStatus === 'pending'"
                    :order-id="order.id"
                    :quantity="1"
                    :amount="order.amount"
                  >
                    <template #trigger="{ loading, open }">
                      <UButton
                        color="primary"
                        variant="outline"
                        class="font-medium"
                        @click="open"
                        :disabled="loading"
                        :loading="loading"
                      >
                        {{ $t('site.payment.payNow') }}
                      </UButton>
                    </template>
                  </PaymentModal>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div
        v-else
        class="bg-[#0A0A0A] border border-white/5 rounded-3xl py-24 text-center"
      >
        <div class="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
          <UIcon
            name="ph:shopping-cart-simple"
            class="w-10 h-10 text-gray-500"
          />
        </div>
        <h3 class="text-xl font-bold text-white mb-2">{{ $t('site.order.noOrders') }}</h3>
        <p class="text-gray-400 mb-8 max-w-md mx-auto">{{ $t('site.order.noOrdersTips') }}</p>
        <UButton
          to="/products"
          color="primary"
          class="bg-purple-600 hover:bg-purple-500 font-medium px-6 py-2 rounded-full"
        >
          {{ $t('site.common.exploreProducts') }}
        </UButton>
      </div>

      <!-- Pagination -->
      <div
        v-if="totalPages > 1"
        class="mt-10 flex justify-center"
      >
        <UPagination
          v-model="page"
          :page-count="10"
          :total="totalItems"
          @update:page="(val) => onPageChange(val, () => refresh())"
        />
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
const { getSetting } = useSettings()

useHead({
  title: `My Orders - ${getSetting('site_name')}`,
})

const { user } = useCustomerAuth()
const { page, pageSize, onPageChange } = usePagination(15)

const {
  data: ordersData,
  pending,
  refresh,
} = await useFetch<any>('/api/orders', {
  query: {
    page,
    pageSize,
  },
  watch: [page],
  onResponseError({ response }: any) {
    if (response.status === 401) {
      useRouter().push('/login')
    }
  },
})

const orders = computed(() => ordersData.value?.data || [])
const totalItems = computed(() => ordersData.value?.total || 0)
const totalPages = computed(() => Math.ceil(totalItems.value / pageSize.value))

watch(page, () => {
  if (typeof window !== 'undefined') {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
})
</script>
