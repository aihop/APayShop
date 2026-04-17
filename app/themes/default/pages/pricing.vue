<template>
  <div class="min-h-screen bg-[#09090b]">
    <div class="max-w-[1440px] mx-auto w-full">
      <!-- Hero Section -->
      <div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-16 overflow-hidden">
        <!-- Background Effects -->
        <div class="absolute inset-0 pointer-events-none">
          <div class="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-purple-600/10 rounded-full blur-[120px] opacity-50"></div>
        </div>

        <div class="relative z-10 text-center mb-16">
          <h1 class="text-4xl md:text-5xl font-sans font-bold mb-4">
            <span class="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500">
              Simple, Transparent Pricing
            </span>
          </h1>
          <p class="text-gray-400 text-lg max-w-2xl mx-auto mt-6">
            Choose the perfect plan for your needs. No hidden fees, cancel anytime.
          </p>
        </div>
      </div>

      <!-- Main Content -->
      <div class="max-w-[1200px] mx-auto px-6 pb-32 relative z-10">
        <div
          v-if="pending"
          class="flex justify-center py-20"
        >
          <UIcon
            name="ph:spinner-gap-bold"
            class="w-10 h-10 animate-spin text-purple-500"
          />
        </div>

        <div
          v-else-if="!plans || plans.length === 0"
          class="text-center py-20"
        >
          <Icon
            name="ph:package-light"
            class="w-16 h-16 text-gray-700 mx-auto mb-4"
          />
          <h3 class="text-xl font-medium text-white mb-2">No Plans Available</h3>
          <p class="text-gray-400">There are currently no active subscription plans.</p>
        </div>

        <div
          v-else
          class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-stretch"
        >
          <div
            v-for="(plan, index) in plans"
            :key="plan.id"
            class="relative group h-full"
          >

            <!-- Glowing border effect for popular plan -->
            <div
              v-if="index === 1"
              class="absolute -inset-0.5 bg-gradient-to-r from-purple-600 to-blue-500 rounded-3xl blur opacity-30 group-hover:opacity-60 transition duration-500"
            ></div>

            <div :class="[
              'bg-[#121214]/90 backdrop-blur-xl rounded-3xl p-8 relative flex flex-col h-full z-10 transition-transform duration-300', 
              index === 1 ? 'border border-gray-800/50 md:-translate-y-4' : 'border border-gray-800 hover:border-gray-700'
            ]">

              <div
                v-if="index === 1"
                class="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-1 rounded-full text-xs font-bold tracking-wider uppercase shadow-[0_0_15px_rgba(168,85,247,0.4)]"
              >
                Most Popular
              </div>

              <div class="mb-8">
                <h3 class="text-2xl font-bold text-white mb-4">{{ plan.name }}</h3>
                <div class="flex items-baseline gap-1 mb-4">
                  <span class="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">${{ plan.price.toFixed(2) }}</span>
                  <span class="text-gray-500 font-medium">/ forever</span>
                </div>
                <p class="text-gray-400 text-sm min-h-[40px]">{{ plan.description || 'Access to premium features' }}</p>
              </div>

              <div class="space-y-4 flex-grow mb-10">
                <div
                  v-for="(feature, i) in getFeatures(plan.featuresJson)"
                  :key="i"
                  class="flex items-start gap-3"
                >
                  <div class="mt-1 w-5 h-5 rounded-full bg-purple-500/10 flex items-center justify-center shrink-0">
                    <Icon
                      name="ph:check-bold"
                      class="w-3 h-3 text-purple-400"
                    />
                  </div>
                  <span class="text-gray-300 text-sm">{{ feature }}</span>
                </div>
              </div>

              <UButton
                :color="index === 1 ? 'primary' : 'neutral'"
                :variant="index === 1 ? 'solid' : 'outline'"
                size="xl"
                block
                class="font-bold tracking-wider uppercase text-sm mt-auto transition-all duration-300"
                :class="index === 1 ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 border-none shadow-[0_0_20px_rgba(168,85,247,0.3)]' : 'border-gray-700 hover:border-purple-500 hover:bg-purple-500/10 text-gray-300 hover:text-white'"
                @click="router.push(`/products/${plan.slug || plan.id}`)"
              >
                Get Started
              </UButton>
            </div>
          </div>
        </div>

        <!-- FAQ Section (Optional enhancement) -->
        <div class="mt-32 max-w-3xl mx-auto">
          <h2 class="text-3xl font-bold text-center text-white mb-12">Frequently Asked Questions</h2>
          <div class="space-y-6">
            <div class="bg-[#121214] border border-gray-800 rounded-2xl p-6">
              <h4 class="text-lg font-bold text-white mb-2 flex items-center gap-2">
                <Icon
                  name="ph:question-fill"
                  class="text-purple-500"
                />
                Is this a one-time payment?
              </h4>
              <p class="text-gray-400 text-sm leading-relaxed ml-7">Yes, currently all our plans are lifetime access with a single one-time payment. No recurring monthly or annual subscription fees.</p>
            </div>
            <div class="bg-[#121214] border border-gray-800 rounded-2xl p-6">
              <h4 class="text-lg font-bold text-white mb-2 flex items-center gap-2">
                <Icon
                  name="ph:question-fill"
                  class="text-purple-500"
                />
                Can I upgrade my plan later?
              </h4>
              <p class="text-gray-400 text-sm leading-relaxed ml-7">Absolutely! You can upgrade to a higher tier plan at any time by simply paying the difference between your current plan and the new one.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const router = useRouter()
const { data: plansData, pending } = await useFetch<any>('/api/products', {
  query: { limit: 100 }
})

const plans = computed(() => {
  if (!plansData.value?.data) return []
  return plansData.value.data.filter((p: any) => p.metaData?.is_pricing_plan)
})

const getFeatures = (jsonStr: string | null) => {
  if (!jsonStr) return []
  try {
    return JSON.parse(jsonStr)
  } catch {
    return []
  }
}
</script>