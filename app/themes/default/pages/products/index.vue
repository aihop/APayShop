<template>
  <div class="min-h-screen bg-[#09090b] pt-24 pb-16">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

      <!-- Header -->
      <div
        class="text-center max-w-3xl mx-auto mb-16"
        v-motion-fade-visible-once
      >
        <h1 class="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-4">
          {{ $t('site.products.title') }} <span class="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">{{ $t('site.products.titleHighlight') }}</span>
        </h1>
        <p class="text-lg text-gray-400">
          {{ $t('site.products.titleTips') }}
        </p>
      </div>

      <!-- Products Grid -->
      <div
        v-if="pending"
        class="flex justify-center items-center py-20"
      >
        <UIcon
          name="ph:spinner-gap-bold"
          class="w-10 h-10 text-purple-500 animate-spin"
        />
      </div>

      <div
        v-else-if="products && products.length > 0"
        class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8"
      >
        <NuxtLink
          v-for="(product, index) in products"
          :key="product.id"
          :to="`/products/${product.slug || product.id}`"
          class="group bg-[#121214] border border-gray-800 rounded-2xl overflow-hidden hover:border-purple-500/50 hover:shadow-[0_0_30px_rgba(168,85,247,0.15)] transition-all duration-300 flex flex-col h-full"
          v-motion-slide-visible-once-bottom="{ delay: index * 100 }"
        >
          <!-- Image -->
          <div class="aspect-w-16 aspect-h-10 w-full overflow-hidden bg-gray-900 relative">
            <img
              v-if="product.imageUrl"
              :src="product.imageUrl"
              :alt="product.name"
              class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <div
              v-else
              class="w-full h-full flex items-center justify-center bg-gray-800 text-gray-600"
            >
              <UIcon
                name="ph:image"
                class="w-12 h-12"
              />
            </div>
          </div>

          <!-- Content -->
          <div class="p-6 flex flex-col flex-grow">
            <div class="flex justify-between items-start mb-2">
              <h3
                class="text-xl font-bold text-white group-hover:text-purple-400 transition-colors line-clamp-1"
                :title="product.name"
              >
                {{ product.name }}
              </h3>
            </div>

            <p class="text-gray-400 text-sm mb-4 line-clamp-2 flex-grow">
              {{ product.description || $t('site.products.noDescription') }}
            </p>

            <div class="flex items-center justify-between mt-auto pt-4 border-t border-gray-800/50">
              <span class="text-2xl font-bold text-white flex items-center">
                <span class="text-purple-500 mr-1">$</span>{{ product.price }}
              </span>

              <div class="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500 transition-colors">
                <UIcon
                  name="ph:arrow-right-bold"
                  class="w-5 h-5 text-purple-500 group-hover:text-white transition-colors"
                />
              </div>
            </div>
          </div>
        </NuxtLink>
      </div>

      <!-- Empty State -->
      <div
        v-else
        class="text-center py-20 bg-[#121214] rounded-3xl border border-gray-800"
      >
        <UIcon
          name="ph:package"
          class="w-16 h-16 text-gray-600 mx-auto mb-4"
        />
        <h3 class="text-xl font-bold text-white mb-2">{{ $t('site.products.emptyTitle') }}</h3>
        <p class="text-gray-400">{{ $t('site.products.emptyDesc') }}</p>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useLocalizedProduct } from '~/composables/useLocalizedProduct'

useHead({
  title: 'Products',
  meta: [
    {
      name: 'description',
      content: 'Explore our premium selection of digital products.',
    },
  ],
})

const { getLocalizedProduct } = useLocalizedProduct()

// Fetch active products
const { data: productsData, status } = await useFetch<any>('/api/products')
const pending = computed(() => status.value === 'pending')

const products = computed(() => {
  if (!productsData.value?.data) return []
  return productsData.value.data
    .filter((p: any) => !p.metaData?.is_pricing_plan)
    .map(getLocalizedProduct)
})
</script>