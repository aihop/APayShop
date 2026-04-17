<template>
  <div
    class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12"
    v-if="product"
  >
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20">
      <!-- Left: Image Gallery -->
      <div
        class="space-y-4"
        v-motion-fade-visible
      >
        <div class="aspect-[4/3] rounded-3xl overflow-hidden bg-gray-900 border border-gray-800 relative group">
          <UCarousel
            v-if="product.imageUrls && product.imageUrls.length > 0"
            :items="product.imageUrls"
            :ui="{ item: 'basis-full' }"
            class="w-full h-full"
            arrows
            indicators
          >
            <template #default="{ item }">
              <img
                :src="String(item)"
                :alt="product.name"
                class="w-full h-full object-contain hover:scale-105 transition-transform duration-500 cursor-zoom-in"
                draggable="false"
              />
            </template>
          </UCarousel>
          <img
            v-else-if="product.imageUrl"
            :src="product.imageUrl"
            :alt="product.name"
            class="w-full h-full object-contain hover:scale-105 transition-transform duration-500 cursor-zoom-in"
          />
          <div
            v-else
            class="w-full h-full flex items-center justify-center"
          >
            <UIcon
              name="ph:image"
              class="w-20 h-20 text-gray-700"
            />
          </div>
        </div>
      </div>

      <!-- Right: Purchase Panel -->
      <div
        class="flex flex-col justify-center"
        v-motion-slide-visible-right
      >
        <h1 class="text-4xl md:text-5xl font-bold text-white mb-6">{{ product.name }}</h1>

        <div class="border-l-4 border-purple-500 pl-4 mb-8">
          <div class="text-5xl font-bold text-white">${{ product.price.toFixed(2) }}</div>
        </div>

        <div class="flex items-center gap-4 mb-8">
          <div class="flex items-center border border-gray-700 rounded-lg overflow-hidden">
            <button
              @click="quantity = Math.max(1, quantity - 1)"
              class="px-4 py-2 hover:bg-gray-800 text-gray-400 transition-colors"
            >-</button>
            <span class="px-4 py-2 border-x border-gray-700 font-medium">{{ quantity }}</span>
            <button
              @click="quantity++"
              class="px-4 py-2 hover:bg-gray-800 text-gray-400 transition-colors"
            >+</button>
          </div>
        </div>

        <PaymentModal
          :product-id="product.id"
          :quantity="quantity"
          :amount="product.price * quantity"
        >
          <template #trigger="{ loading, open }">
            <UButton
              color="primary"
              size="xl"
              block
              class="h-16 text-lg font-bold bg-purple-600 hover:bg-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.3)] hover:shadow-[0_0_30px_rgba(168,85,247,0.6)] transition-shadow text-white"
              @click="open"
              :disabled="loading"
              :loading="loading"
            >
              Buy It Now
            </UButton>
          </template>
        </PaymentModal>
      </div>
    </div>

    <!-- Details Section -->
    <div class="mt-24 border-t border-gray-800 pt-16">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-12">
        <div class="md:col-span-2">
          <h2 class="text-2xl font-bold mb-6">Description</h2>
          <div class="bg-[#121214] border border-gray-800 rounded-2xl p-8">
            <div class="prose prose-invert max-w-none">
              <p
                v-if="product.description"
                class="text-gray-300 leading-relaxed whitespace-pre-wrap"
              >{{ product.description }}</p>
              <p
                v-else-if="!product.content"
                class="text-gray-500 italic text-center py-8"
              >No description provided yet.</p>
              <div
                v-if="product.content"
                class="mt-6 pt-6 border-t border-gray-800"
                v-html="product.content"
              ></div>
            </div>
          </div>
        </div>

        <div>
          <h2 class="text-2xl font-bold mb-6 flex items-center gap-2">
            Reviews
            <span class="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded-full">0</span>
          </h2>
          <div class="bg-[#121214] border border-gray-800 rounded-2xl p-8 flex flex-col items-center text-center">
            <p class="text-gray-500 mb-6">No reviews yet. Be the first to share your thoughts!</p>
            <UButton
              color="neutral"
              variant="solid"
              class="rounded-full rounded-lg px-6 bg-white text-black hover:bg-gray-200"
            >
              Write a Review
              <template #trailing>
                <Icon name="ph:arrow-right" />
              </template>
            </UButton>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div
    v-else-if="pending"
    class="flex justify-center py-32"
  >
    <UIcon
      name="ph:spinner-gap-bold"
      class="w-8 h-8 animate-spin text-purple-500"
    />
  </div>
  <div
    v-else
    class="text-center py-32"
  >
    <h2 class="text-2xl font-bold text-gray-400">Product not found</h2>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useFetch } from '#imports'
import { useLocalizedProduct } from '~/composables/useLocalizedProduct'

const route = useRoute()
const quantity = ref(1)

const { getLocalizedProduct } = useLocalizedProduct()

const { data: productData, pending } = await useFetch(
  `/api/products/${route.params.slug[1]}`,
  {
    transform: (data: any) => {
      if (data && typeof data.imageUrls === 'string') {
        try {
          data.imageUrls = JSON.parse(data.imageUrls)
        } catch (e) {
          data.imageUrls = []
        }
      }
      return data
    },
  }
)

const product = computed(() => getLocalizedProduct(productData.value))
</script>