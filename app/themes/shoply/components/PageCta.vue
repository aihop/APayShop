<template>
  <section class="bg-[#07152f] px-5 py-20 text-white sm:px-8 sm:py-24">
    <div class="mx-auto max-w-4xl text-center">
      <p class="text-sm font-black tracking-[0.18em] text-cyan-300 uppercase">Shoply</p>
      <h2 class="mt-5 text-3xl font-black tracking-[-0.035em] sm:text-5xl">{{ title }}</h2>
      <p class="mx-auto mt-5 max-w-2xl text-base leading-8 text-blue-100/70">{{ description }}</p>
      <div class="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <a :href="primaryUrl" class="rounded-full bg-white px-7 py-3.5 text-sm font-extrabold text-blue-700 transition-transform hover:-translate-y-0.5">
          {{ primaryLabel }}
        </a>
        <a :href="secondaryUrl" class="rounded-full border border-white/20 bg-white/10 px-7 py-3.5 text-sm font-extrabold text-white transition-colors hover:bg-white/20">
          {{ secondaryLabel }}
        </a>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  description: string
  primaryLabel: string
  secondaryLabel: string
  primaryUrl: string
  secondaryUrl: string
}>()
</script>
