<template>
  <div class="bg-[#09090b]">
    <!-- Hero Section -->
    <div class="relative overflow-hidden pt-32 pb-20 lg:pt-48 lg:pb-32">
      <div class="absolute inset-0 bg-[url('https://res.cloudinary.com/djp1xxy6f/image/upload/v1711626002/grid_y6fxgw.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]"></div>

      <div class="relative max-w-[1400px] w-full px-6 lg:px-12 mx-auto text-center">
        <div
          class="flex flex-col items-center text-center space-y-8 mb-24"
          v-motion-fade-visible-once
        >
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-purple-500/30 bg-purple-500/10 text-xs font-medium text-purple-300">
            <Icon
              name="heroicons:sparkles"
              class="w-4 h-4"
            />
            AI-Powered Short Drama Content Platform
          </div>

          <h1 class="text-5xl md:text-7xl font-bold tracking-tight text-white relative">
            <div class="absolute -inset-4 bg-purple-500/20 blur-3xl -z-10 rounded-full"></div>
            Redefining Short Drama <br />
            <span class="text-transparent bg-clip-text bg-gradient-to-r from-gray-100 to-gray-400">with AI Technology</span>
          </h1>

          <p class="text-gray-400 max-w-2xl text-lg leading-relaxed">
            Leveraging cutting-edge artificial intelligence technology to create creative and emotionally resonant short drama works, bringing audiences a brand new audiovisual experience.
          </p>

          <div class="flex flex-col sm:flex-row gap-4 pt-4">
            <NuxtLink to="/products">
              <UButton
                color="primary"
                class="bg-purple-600 hover:bg-purple-500 text-white rounded-full px-8 shadow-[0_0_20px_rgba(168,85,247,0.4)]"
                size="xl"
              >
                <template #leading>
                  <Icon
                    name="ph:play"
                    class="w-5 h-5"
                  />
                </template>
                Explore Products
              </UButton>
            </NuxtLink>
            <UButton
              color="neutral"
              variant="ghost"
              size="xl"
              class="rounded-full px-8 ring-1 ring-gray-700 hover:ring-purple-500 transition-all"
            >
              Learn More
              <template #trailing>
                <Icon
                  name="ph:arrow-right"
                  class="w-5 h-5"
                />
              </template>
            </UButton>
          </div>
        </div>

        <!-- Featured Visual Section -->
        <div
          class="relative w-full aspect-video md:aspect-[21/9] rounded-3xl overflow-hidden border border-gray-800 shadow-2xl group"
          v-motion-slide-visible-once-bottom
        >
          <img
            src="https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=2059&auto=format&fit=crop"
            alt="Featured"
            class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>

          <div class="absolute bottom-0 left-0 right-0 p-8 flex items-end">
            <div class="flex items-center gap-4 bg-black/40 backdrop-blur-md p-4 rounded-2xl border border-white/10">
              <UButton
                color="neutral"
                variant="solid"
                class="rounded-full w-12 h-12 flex items-center justify-center bg-white text-black hover:bg-gray-200"
              >
                <Icon
                  name="ph:play-fill"
                  class="w-5 h-5"
                />
              </UButton>
              <div class="text-left">
                <h3 class="font-bold text-white">Watch Our Showreel</h3>
                <p class="text-sm text-gray-300">Explore our AI short drama collection</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Products Section -->
        <div
          id="products"
          class="mt-32"
        >
          <div
            class="text-center mb-16"
            v-motion-fade-visible-once
          >
            <h2 class="text-3xl font-bold mb-4">Latest Releases</h2>
            <p class="text-gray-400">Discover our newest AI-generated content</p>
          </div>

          <div
            v-if="status === 'pending'"
            class="flex justify-center py-20"
          >
            <UIcon
              name="ph:spinner-gap-bold"
              class="w-8 h-8 animate-spin text-purple-500"
            />
          </div>

          <div
            v-else-if="products.length > 0"
            class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 text-left"
            v-motion-fade-visible-once
          >
            <NuxtLink
              v-for="product in products"
              :key="product.id"
              :to="`/products/${product.slug || product.id}`"
              class="group block h-full"
            >
              <div class="bg-[#121214] rounded-2xl overflow-hidden border border-gray-800 hover:border-purple-500/50 transition-colors shadow-lg h-full flex flex-col">
                <div class="aspect-video overflow-hidden relative bg-gray-900">
                  <img
                    v-if="product.imageUrl"
                    :src="String(product.imageUrl)"
                    :alt="String(product.name)"
                    class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div
                    v-else
                    class="w-full h-full flex items-center justify-center"
                  >
                    <UIcon
                      name="ph:image"
                      class="w-12 h-12 text-gray-700"
                    />
                  </div>
                </div>
                <div class="p-6 flex flex-col flex-grow">
                  <div class="flex justify-between items-start mb-2">
                    <h3 class="text-lg font-bold text-white group-hover:text-purple-400 transition-colors line-clamp-1">{{ product.name }}</h3>
                    <span class="text-purple-400 font-medium whitespace-nowrap ml-2">${{ Number(product.price).toFixed(2) }}</span>
                  </div>
                  <p class="text-gray-400 text-sm line-clamp-2 mt-auto">{{ product.description || "No description available." }}</p>
                </div>
              </div>
            </NuxtLink>
          </div>

          <div
            v-else
            class="text-center py-20 text-gray-500"
          >
            No products available at the moment.
          </div>

          <div
            class="text-center mt-12"
            v-if="products.length > 0"
          >
            <NuxtLink to="/products">
              <UButton
                color="neutral"
                variant="outline"
                size="lg"
                class="rounded-full px-8 ring-1 ring-gray-700 hover:ring-purple-500 hover:text-purple-400 transition-all"
              >
                View All Products
                <template #trailing>
                  <Icon
                    name="ph:arrow-right"
                    class="w-4 h-4"
                  />
                </template>
              </UButton>
            </NuxtLink>
          </div>
        </div>

        <!-- Features Section -->
        <div class="mt-32 py-20 border-t border-gray-800/50 relative">
          <div class="absolute inset-0 bg-gradient-to-b from-purple-900/5 to-transparent pointer-events-none"></div>

          <div
            class="text-center mb-16 relative z-10"
            v-motion-fade-visible-once
          >
            <h2 class="text-3xl font-bold mb-4">Why Choose {{ getSetting('site_name') || 'Your Site' }}?</h2>
            <p class="text-gray-400 max-w-2xl mx-auto">Experience the next generation of digital entertainment powered by advanced artificial intelligence.</p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
            <!-- Feature 1 -->
            <div
              class="bg-[#121214]/80 backdrop-blur-sm p-8 rounded-3xl border border-gray-800 hover:border-purple-500/30 transition-colors group"
              v-motion-slide-visible-once-bottom
            >
              <div class="w-14 h-14 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Icon
                  name="ph:magic-wand-fill"
                  class="w-7 h-7 text-purple-400"
                />
              </div>
              <h3 class="text-xl font-bold text-white mb-3">AI-Driven Creativity</h3>
              <p class="text-gray-400 leading-relaxed">Unique storylines and visuals generated through state-of-the-art AI algorithms, ensuring fresh and engaging content.</p>
            </div>

            <!-- Feature 2 -->
            <div
              class="bg-[#121214]/80 backdrop-blur-sm p-8 rounded-3xl border border-gray-800 hover:border-blue-500/30 transition-colors group"
              v-motion-slide-visible-once-bottom
              :delay="100"
            >
              <div class="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Icon
                  name="ph:lightning-fill"
                  class="w-7 h-7 text-blue-400"
                />
              </div>
              <h3 class="text-xl font-bold text-white mb-3">Instant Delivery</h3>
              <p class="text-gray-400 leading-relaxed">Get immediate access to your purchased content. No waiting times, just seamless digital entertainment.</p>
            </div>

            <!-- Feature 3 -->
            <div
              class="bg-[#121214]/80 backdrop-blur-sm p-8 rounded-3xl border border-gray-800 hover:border-pink-500/30 transition-colors group"
              v-motion-slide-visible-once-bottom
              :delay="200"
            >
              <div class="w-14 h-14 rounded-2xl bg-pink-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Icon
                  name="ph:device-mobile-camera-fill"
                  class="w-7 h-7 text-pink-400"
                />
              </div>
              <h3 class="text-xl font-bold text-white mb-3">Anywhere Access</h3>
              <p class="text-gray-400 leading-relaxed">Enjoy our short dramas on any device. Fully responsive and optimized for mobile, tablet, and desktop viewing.</p>
            </div>
          </div>
        </div>

        <!-- CTA Section -->
        <div
          class="mt-16 mb-20 relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-900/40 to-blue-900/40 border border-purple-500/20 p-12 text-center"
          v-motion-fade-visible-once
        >
          <div class="absolute inset-0 bg-[url('https://res.cloudinary.com/djp1xxy6f/image/upload/v1711626002/grid_y6fxgw.svg')] bg-center opacity-20"></div>
          <div class="relative z-10">
            <h2 class="text-3xl md:text-4xl font-bold text-white mb-6">Ready to Experience the Future?</h2>
            <p class="text-gray-300 mb-8 max-w-2xl mx-auto">Join thousands of users who have already discovered the magic of AI-generated short dramas. Start your journey today.</p>
            <NuxtLink to="/products">
              <UButton
                color="primary"
                size="xl"
                class="rounded-full px-10 font-bold bg-white text-purple-900 hover:bg-gray-100 shadow-[0_0_30px_rgba(255,255,255,0.3)]"
              >
                Browse Catalog
              </UButton>
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useLocalizedProduct } from '~/composables/useLocalizedProduct'

const { getSetting } = useSettings()
const { getLocalizedProduct } = useLocalizedProduct()

const { data: productsData, status } = await useFetch<any>('/api/products', {
  key: 'homepage-products',
})

// Filter out plans from products list and limit to 6 items
const products = computed(() => {
  if (!productsData.value?.data) return []
  return productsData.value.data
    .filter((p: any) => !p.metaData?.is_pricing_plan)
    .slice(0, 6)
    .map(getLocalizedProduct)
})
</script>