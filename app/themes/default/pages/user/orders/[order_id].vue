<template>
  <div class="min-h-screen bg-[#050505] pt-32 pb-20 px-6">
    <div class="max-w-4xl mx-auto">

      <!-- Back Navigation -->
      <NuxtLink
        to="/user/orders"
        class="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8"
      >
        <UIcon
          name="ph:arrow-left"
          class="w-4 h-4"
        />
        Back to Orders
      </NuxtLink>

      <div
        v-if="pending"
        class="animate-pulse space-y-6"
      >
        <div class="h-32 bg-[#0A0A0A] border border-white/5 rounded-2xl"></div>
        <div class="h-64 bg-[#0A0A0A] border border-white/5 rounded-2xl"></div>
      </div>

      <div
        v-else-if="order"
        class="space-y-6"
      >
        <!-- Header Card -->
        <div class="bg-[#0A0A0A] border border-white/10 rounded-2xl p-6 md:p-8">
          <div class="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8">
            <div>
              <h1 class="text-2xl md:text-3xl font-bold text-white mb-2">Order #{{ order.id }}</h1>
              <p class="text-gray-400 flex items-center gap-2">
                <UIcon
                  name="ph:calendar-blank"
                  class="w-4 h-4"
                />
                {{ new Date(order.createdAt).toLocaleString() }}
              </p>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-2xl font-bold text-emerald-400">${{ order.amount }}</span>
              <div class="flex gap-2">
                <UBadge
                  v-if="order.payStatus === 'paid' || order.payStatus === 'delivered'"
                  color="success"
                  variant="subtle"
                  class="font-medium px-3 py-1 text-sm"
                >
                  <UIcon
                    name="ph:check-circle-fill"
                    class="w-4 h-4 mr-1"
                  />
                  Paid
                </UBadge>
                <UBadge
                  v-else-if="order.payStatus === 'pending'"
                  color="warning"
                  variant="subtle"
                  class="font-medium px-3 py-1 text-sm"
                >
                  <UIcon
                    name="ph:clock-fill"
                    class="w-4 h-4 mr-1"
                  />
                  Pending Pay
                </UBadge>
                <UBadge
                  v-else
                  color="error"
                  variant="subtle"
                  class="font-medium px-3 py-1 text-sm uppercase"
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
                  class="font-medium px-3 py-1 text-sm capitalize"
                >
                  <UIcon
                    name="ph:package"
                    class="w-4 h-4 mr-1"
                  />
                  {{ order.status }}
                </UBadge>
              </div>
            </div>
          </div>

          <!-- Product Summary -->
          <div class="flex flex-col md:flex-row items-center gap-6 p-4 bg-white/5 rounded-xl border border-white/5">
            <div class="w-full md:w-24 h-24 bg-gray-900 rounded-lg overflow-hidden shrink-0">
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
                  name="ph:package"
                  class="w-8 h-8"
                />
              </div>
            </div>
            <div class="flex-grow">
              <div class="flex items-center gap-2 mb-1">
                <span class="px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded text-xs font-bold uppercase tracking-wider">{{ order.productType }}</span>
                <h3 class="text-xl font-bold text-white">{{ order.productName }}</h3>
              </div>
              <p class="text-gray-400 text-sm mb-3">{{ $t('site.payment.successTips') }}</p>
              <UButton
                v-if="order.productSlug"
                :to="`/products/${order.productSlug}`"
                target="_blank"
                variant="ghost"
                color="neutral"
                size="sm"
                class="text-gray-300 hover:text-white"
              >
                View Product Page
                <UIcon
                  name="ph:arrow-square-out"
                  class="w-4 h-4 ml-1"
                />
              </UButton>
            </div>
          </div>
        </div>

        <!-- Details Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Payment Info -->
          <div class="bg-[#0A0A0A] border border-white/10 rounded-2xl p-6">
            <div class="flex items-center gap-2 text-white font-bold mb-6">
              <UIcon
                name="ph:credit-card"
                class="w-5 h-5 text-purple-400"
              />
              <h3>{{ $t('site.payment.PaymentDetails') }}</h3>
            </div>
            <div class="space-y-4">
              <div class="flex justify-between items-center py-3 border-b border-white/5">
                <span class="text-gray-400">{{ $t('site.payment.payMethod') }}</span>
                <span class="text-white font-medium capitalize">{{ order.payMethod || 'N/A' }}</span>
              </div>
              <div class="flex justify-between items-center py-3 border-b border-white/5">
                <span class="text-gray-400">{{ $t('site.payment.tradeNo') }}</span>
                <span class="text-white font-mono text-sm">{{ order.tradeNo || 'Pending' }}</span>
              </div>
              <div class="flex justify-between items-center py-3 border-b border-white/5">
                <span class="text-gray-400">{{ $t('site.payment.contactEmail') }}</span>
                <span class="text-white">{{ order.contactEmail || 'N/A' }}</span>
              </div>
              <div class="flex justify-between items-center py-3">
                <span class="text-gray-400">{{ $t('site.payment.paidAt') }}</span>
                <span class="text-white">{{ order.paidAt ? new Date(order.paidAt).toLocaleString() : 'N/A' }}</span>
              </div>
            </div>
          </div>

          <!-- Fulfillment Info -->
          <div class="bg-[#0A0A0A] border border-white/10 rounded-2xl p-6">
            <div class="flex items-center gap-2 text-white font-bold mb-6">
              <UIcon
                name="ph:rocket-launch"
                class="w-5 h-5 text-purple-400"
              />
              <h3>Delivery Information</h3>
            </div>

            <div
              v-if="order.status === 'paid' || order.status === 'delivered' || order.status === 'active'"
              class="space-y-4"
            >
              <!-- Key/Card Delivery -->
              <div
                v-if="order.productType === 'key' && order.deliveryInfo"
                class="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4"
              >
                <p class="text-sm text-emerald-400 mb-2 font-medium">Your License Key</p>
                <div class="bg-black/50 p-3 rounded border border-white/10 font-mono text-white text-sm break-all select-all">
                  {{ order.deliveryInfo }}
                </div>
              </div>

              <!-- File Delivery -->
              <div
                v-else-if="order.productType === 'file' && order.deliveryInfo"
                class="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4"
              >
                <p class="text-sm text-blue-400 mb-3 font-medium">Your Download Link</p>
                <UButton
                  :to="order.deliveryInfo"
                  target="_blank"
                  color="primary"
                  class="w-full justify-center bg-blue-600 hover:bg-blue-500 text-white font-medium"
                >
                  <UIcon
                    name="ph:download-simple"
                    class="w-5 h-5 mr-2"
                  />
                  Download File
                </UButton>
              </div>

              <!-- Other Types -->
              <div
                v-else
                class="bg-white/5 border border-white/10 rounded-xl p-4 text-gray-300 text-sm whitespace-pre-wrap"
              >
                {{ order.deliveryInfo || 'Your order is being processed. Please check back later or contact support.' }}
              </div>
            </div>

            <!-- Unpaid State -->
            <div
              v-else-if="order.payStatus === 'pending'"
              class="h-full flex flex-col items-center justify-center text-center py-8"
            >
              <UIcon
                name="ph:wallet"
                class="w-12 h-12 text-amber-500/50 mb-3"
              />
              <p class="text-gray-400 mb-4">Payment is required before delivery information can be accessed.</p>
              <PaymentModal
                :order-id="order.id"
                :quantity="1"
                :amount="order.amount"
              >
                <template #trigger="{ loading, open }">
                  <UButton
                    color="primary"
                    class="bg-purple-600 hover:bg-purple-500 text-white font-medium px-8"
                    @click="open"
                    :disabled="loading"
                    :loading="loading"
                  >
                    Pay Now
                  </UButton>
                </template>
              </PaymentModal>
            </div>

            <!-- Failed/Expired State -->
            <div
              v-else
              class="h-full flex flex-col items-center justify-center text-center py-8"
            >
              <UIcon
                name="ph:x-circle"
                class="w-12 h-12 text-red-500/50 mb-3"
              />
              <p class="text-gray-400">This order has been cancelled or expired.</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Not Found State -->
      <div
        v-else
        class="bg-[#0A0A0A] border border-white/5 rounded-3xl py-24 text-center"
      >
        <UIcon
          name="ph:file-x-bold"
          class="w-16 h-16 text-gray-600 mb-4 mx-auto"
        />
        <h3 class="text-xl font-bold text-white mb-2">Order Not Found</h3>
        <p class="text-gray-400 mb-8">The order you're looking for doesn't exist or you don't have permission to view it.</p>
        <UButton
          to="/user/orders"
          color="neutral"
          variant="solid"
        >
          Back to Orders
        </UButton>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const route = useRoute()
const orderId = route.params['slug']?.[2] as string

const { getSetting } = useSettings()

useHead({
  title: `My Order #${orderId} - ${getSetting('site_name')}`,
})

const { data: order, status } = await useFetch<any>(`/api/orders/detail`, {
  headers: useRequestHeaders(['cookie']),
  lazy: true,
  query: {
    orderId,
  },
  onResponseError({ response }: any) {
    if (response.status === 401) {
      useRouter().push('/login')
    }
  },
})

console.log(order.value)

const pending = computed(() => status.value === 'pending')
</script>
