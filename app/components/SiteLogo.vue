<template>
  <div
    :class="['inline-flex items-center justify-center overflow-hidden', containerClass]"
    :style="containerStyle"
  >
    <div
      v-if="isSvgCode"
      v-html="logoData"
      :class="['w-full h-full flex items-center justify-center [&>svg]:w-full [&>svg]:h-full', imageClass]"
      :style="{ color: iconColor }"
    ></div>
    <img
      v-else-if="logoData"
      :src="logoData"
      :alt="alt || 'Site Logo'"
      :class="['object-contain w-full h-full', imageClass]"
    />
    <div
      v-else
      :class="['w-full h-full flex items-center justify-center', imageClass]"
    >
      <UIcon
        v-if="defaultIcon?.name"
        :name="defaultIcon.name"
        :class="['w-full h-full', defaultIcon.class]"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export interface DefaultIconProps {
  name: string
  class: string
}

const props = withDefaults(
  defineProps<{
    logoData?: string
    alt?: string
    containerClass?: string
    imageClass?: string
    containerStyle?: Record<string, string>
    iconColor?: string
    defaultIcon?: DefaultIconProps
  }>(),
  {
    defaultIcon: () => ({
      name: 'material-symbols:shopping-bag-speed-outline',
      class: 'text-white w-6 h-6',
    }),
  }
)

// Determine if the input data is direct SVG code or an image URL
const isSvgCode = computed(() => {
  if (!props.logoData) return false
  const trimmed = props.logoData.trim()
  return trimmed.startsWith('<svg') && trimmed.endsWith('</svg>')
})
</script>