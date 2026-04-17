<template>
  <div>
    <div class="mb-10 flex items-center gap-4">
      <UButton
        icon="i-heroicons-arrow-left"
        color="gray"
        variant="ghost"
        to="/admin/themes"
      />
      <div>
        <h1 class="text-3xl font-bold text-white tracking-tight">Theme Configuration</h1>
        <p class="text-gray-400 mt-2 text-sm">Configure specific settings for the <span class="text-purple-400 font-bold">{{ schema?.name || route.params.theme }}</span> theme.</p>
      </div>
    </div>

    <div
      v-if="pending"
      class="flex justify-center py-20"
    >
      <UIcon
        name="ph:spinner-gap-bold"
        class="w-8 h-8 animate-spin text-purple-500"
      />
    </div>

    <div
      v-else-if="!schema || !schema.settings || schema.settings.length === 0"
      class="text-center py-20 bg-[#121214] border border-gray-800/50 rounded-2xl"
    >
      <UIcon
        name="i-heroicons-cog-6-tooth"
        class="w-16 h-16 text-gray-700 mx-auto mb-4"
      />
      <h2 class="text-xl font-bold text-white mb-2">No configuration needed</h2>
      <p class="text-gray-400">This theme does not expose any custom settings.</p>
    </div>

    <div
      v-else
      class="max-w-2xl bg-[#121214] border border-gray-800/50 rounded-2xl p-8"
    >
      <div class="mb-8 pb-8 border-b border-gray-800/50">
        <h2 class="text-xl font-bold text-white mb-2">{{ schema.name }}</h2>
        <p class="text-sm text-gray-400 mb-4">{{ schema.description }}</p>
        <div class="flex gap-4 text-xs text-gray-500">
          <span>Version: {{ schema.version }}</span>
          <span>Author: {{ schema.author }}</span>
        </div>
      </div>

      <form
        @submit.prevent="saveSettings"
        class="space-y-6"
      >
        <UFormField
          v-for="field in schema.settings"
          :key="field.key"
          :label="field.label"
          :description="field.description"
        >
          <UInput
            v-if="field.type === 'string'"
            v-model="form[field.key]"
            :placeholder="field.default"
          />
          <UToggle
            v-else-if="field.type === 'boolean'"
            v-model="form[field.key]"
          />
          <UTextarea
            v-else-if="field.type === 'text'"
            v-model="form[field.key]"
            :rows="3"
            :placeholder="field.default"
          />
        </UFormField>

        <USeparator class="my-8" />

        <div class="flex justify-end">
          <UButton
            color="primary"
            class="bg-purple-600 hover:bg-purple-500 text-white"
            type="submit"
            size="lg"
            :loading="isSaving"
          >Save Theme Settings</UButton>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watchEffect, computed } from 'vue'
import {
  useRoute,
  useRouter,
  useToast,
  useFetch,
  useCookie,
  definePageMeta,
} from '#imports'

definePageMeta({ title: 'Theme Configuration' })

const route = useRoute()
const router = useRouter()
const toast = useToast()
const themeName = route.params.theme as string

const form = reactive<Record<string, any>>({})
const isSaving = ref(false)

// Fetch theme schema and saved values
const { data, pending } = await useFetch(`/api/admin/theme/${themeName}`, {
  onResponseError({ response }) {
    if (response.status === 401) {
      router.push('/admin/login')
    }
  },
})

// Extract schema and init form
const schema = computed(() => data.value?.schema)
const savedConfig = computed(() => data.value?.config || {})

watchEffect(() => {
  if (schema.value?.settings) {
    schema.value.settings.forEach((field: any) => {
      // Priority: Saved DB value > Schema Default value
      if (savedConfig.value[field.key] !== undefined) {
        form[field.key] = savedConfig.value[field.key]
      } else if (field.default !== undefined) {
        form[field.key] = field.default
      }
    })
  }
})

const saveSettings = async () => {
  isSaving.value = true
  try {
    await $fetch(`/api/admin/theme/${themeName}`, {
      method: 'POST',
      body: form,
    })
    toast.add({
      title: 'Success',
      description: 'Theme settings saved successfully',
      color: 'success',
    })
  } catch (e: any) {
    toast.add({
      title: 'Error',
      description: e.data?.message || 'Failed to save theme settings',
      color: 'error',
    })
  } finally {
    isSaving.value = false
  }
}
</script>