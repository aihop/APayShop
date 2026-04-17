<template>
  <div class="h-[calc(100vh-8rem)] flex flex-col">
    <div class="mb-6">
      <h1 class="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
        <div class="p-2 bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-lg border border-purple-500/30">
          <UIcon
            name="i-heroicons-sparkles-solid"
            class="w-6 h-6 text-purple-400"
          />
        </div>
        AI Theme Builder
      </h1>
      <p class="text-gray-400 mt-2 text-sm max-w-2xl">
        Describe the storefront you want to build. Our AI will automatically generate the Vue components, Tailwind styles, and configurations following APayShop's architecture.
      </p>
    </div>

    <!-- Main Workspace -->
    <div class="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">

      <!-- Left: Chat Interface -->
      <div class="lg:col-span-1 bg-[#121214] border border-gray-800/50 rounded-2xl flex flex-col overflow-hidden">
        <!-- Chat History -->
        <div
          class="flex-1 overflow-y-auto p-4 space-y-4"
          ref="chatContainer"
        >
          <!-- Initial Greeting -->
          <div class="flex gap-3">
            <div class="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center flex-shrink-0">
              <UIcon
                name="i-heroicons-sparkles"
                class="w-4 h-4 text-white"
              />
            </div>
            <div class="bg-gray-800/50 border border-gray-700/50 rounded-2xl rounded-tl-sm p-4 text-sm text-gray-200">
              Hello! I'm your APayShop AI Developer. I can help you create a brand new theme or modify an existing one.
              <br><br>
              Try saying: <br>
              <span class="text-purple-400 cursor-pointer hover:underline mt-1 inline-block">"Build a minimalist white theme for selling eBooks"</span>
            </div>
          </div>

          <!-- Messages -->
          <div
            v-for="(msg, idx) in messages"
            :key="idx"
            class="flex gap-3"
            :class="msg.role === 'user' ? 'flex-row-reverse' : ''"
          >
            <div
              v-if="msg.role === 'ai'"
              class="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center flex-shrink-0"
            >
              <UIcon
                name="i-heroicons-sparkles"
                class="w-4 h-4 text-white"
              />
            </div>

            <div
              class="max-w-[85%] rounded-2xl p-4 text-sm"
              :class="msg.role === 'user' 
                ? 'bg-purple-600 text-white rounded-tr-sm' 
                : 'bg-gray-800/50 border border-gray-700/50 text-gray-200 rounded-tl-sm'"
            >
              <div v-html="formatMessage(msg.content)"></div>

              <!-- Generation Status/Actions -->
              <div
                v-if="msg.actions"
                class="mt-4 pt-3 border-t border-gray-700/50 flex gap-2"
              >
                <UButton
                  size="xs"
                  color="neutral"
                  variant="solid"
                  icon="i-heroicons-eye"
                >Preview</UButton>
                <UButton
                  size="xs"
                  color="primary"
                  variant="soft"
                  icon="i-heroicons-check"
                >Apply Theme</UButton>
              </div>
            </div>
          </div>

          <!-- Loading Indicator -->
          <div
            v-if="isGenerating"
            class="flex gap-3"
          >
            <div class="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center flex-shrink-0 animate-pulse">
              <UIcon
                name="i-heroicons-sparkles"
                class="w-4 h-4 text-white"
              />
            </div>
            <div class="bg-gray-800/50 border border-gray-700/50 rounded-2xl rounded-tl-sm p-4 flex items-center gap-2">
              <UIcon
                name="ph:spinner-gap-bold"
                class="w-4 h-4 animate-spin text-purple-400"
              />
              <span class="text-sm text-gray-400">Generating code...</span>
            </div>
          </div>
        </div>

        <!-- Input Area -->
        <div class="p-4 bg-gray-900/50 border-t border-gray-800/50">
          <form
            @submit.prevent="sendMessage"
            class="relative"
          >
            <UTextarea
              v-model="prompt"
              placeholder="Describe the theme you want to build..."
              :rows="3"
              class="w-full bg-black/50"
              @keydown.enter.prevent="sendMessage"
            />
            <div class="absolute bottom-2 right-2 flex items-center gap-2">
              <UButton
                type="submit"
                color="primary"
                class="bg-purple-600 hover:bg-purple-500"
                icon="i-heroicons-paper-airplane"
                :loading="isGenerating"
                :disabled="!prompt.trim() || isGenerating"
              >
                Send
              </UButton>
            </div>
          </form>
          <div class="text-[10px] text-gray-500 mt-2 text-center">
            AI can make mistakes. Always preview the theme before applying it to production.
          </div>
        </div>
      </div>

      <!-- Right: Preview / File Explorer -->
      <div class="lg:col-span-2 bg-[#121214] border border-gray-800/50 rounded-2xl flex flex-col overflow-hidden relative">
        <div class="h-12 border-b border-gray-800/50 flex items-center justify-between px-4 bg-gray-900/30">
          <div class="flex gap-4">
            <button
              class="text-sm font-medium transition-colors"
              :class="activeTab === 'preview' ? 'text-white border-b-2 border-purple-500' : 'text-gray-500 hover:text-gray-300'"
              @click="activeTab = 'preview'"
            >
              Live Preview
            </button>
            <button
              class="text-sm font-medium transition-colors"
              :class="activeTab === 'code' ? 'text-white border-b-2 border-purple-500' : 'text-gray-500 hover:text-gray-300'"
              @click="activeTab = 'code'"
            >
              Generated Files
            </button>
          </div>

          <div class="flex items-center gap-2">
            <span class="text-xs text-gray-500">Target Theme Name:</span>
            <UInput
              v-model="themeName"
              size="xs"
              class="w-32"
              placeholder="e.g. cyber"
            />
          </div>
        </div>

        <!-- Preview Area -->
        <div
          v-show="activeTab === 'preview'"
          class="flex-1 bg-black relative"
        >
          <div
            v-if="!hasGenerated"
            class="absolute inset-0 flex flex-col items-center justify-center text-gray-600"
          >
            <UIcon
              name="i-heroicons-computer-desktop"
              class="w-16 h-16 mb-4 opacity-50"
            />
            <p>Preview will appear here after generation</p>
          </div>
          <iframe
            v-else
            :src="`/?preview_theme=${themeName}`"
            class="w-full h-full border-0"
            title="Theme Preview"
          ></iframe>
        </div>

        <!-- Code Explorer Area -->
        <div
          v-show="activeTab === 'code'"
          class="flex-1 p-4 overflow-y-auto bg-[#0d0d0f]"
        >
          <div
            v-if="!hasGenerated"
            class="h-full flex flex-col items-center justify-center text-gray-600"
          >
            <UIcon
              name="i-heroicons-code-bracket"
              class="w-16 h-16 mb-4 opacity-50"
            />
            <p>Generated files will appear here</p>
          </div>
          <div
            v-else
            class="space-y-4"
          >
            <div
              v-for="(file, path) in generatedFiles"
              :key="path"
              class="border border-gray-800 rounded-lg overflow-hidden"
            >
              <div class="bg-gray-900 px-4 py-2 text-xs font-mono text-gray-400 border-b border-gray-800 flex justify-between items-center">
                <span>{{ path }}</span>
                <UIcon
                  name="i-heroicons-document-text"
                  class="w-4 h-4"
                />
              </div>
              <pre class="p-4 text-xs text-gray-300 font-mono overflow-x-auto"><code>{{ file }}</code></pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'

definePageMeta({ title: 'AI Theme Builder' })

const prompt = ref('')
const isGenerating = ref(false)
const hasGenerated = ref(false)
const activeTab = ref('preview')
const themeName = ref('ai_generated_1')
const chatContainer = ref<HTMLElement | null>(null)

const messages = ref<
  { role: 'user' | 'ai'; content: string; actions?: boolean }[]
>([])
const generatedFiles = ref<Record<string, string>>({})

const formatMessage = (text: string) => {
  return text.replace(/\n/g, '<br>')
}

const scrollToBottom = async () => {
  await nextTick()
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight
  }
}

const sendMessage = async () => {
  if (!prompt.value.trim() || isGenerating.value) return

  const userText = prompt.value
  messages.value.push({ role: 'user', content: userText })
  prompt.value = ''
  isGenerating.value = true
  await scrollToBottom()

  try {
    const res: any = await $fetch('/api/admin/ai/generate', {
      method: 'POST',
      body: {
        prompt: userText,
        themeName: themeName.value,
      },
    })

    if (res.success) {
      messages.value.push({
        role: 'ai',
        content: `I've created the **${themeName.value}** theme based on your request. I've automatically written the files into the \`app/themes/${themeName.value}\` directory. You can check the code and live preview on the right.`,
        actions: true,
      })

      generatedFiles.value = res.files
      hasGenerated.value = true
    }
  } catch (e: any) {
    messages.value.push({
      role: 'ai',
      content: `Sorry, an error occurred: ${
        e.message || 'Failed to generate theme'
      }`,
    })
  } finally {
    isGenerating.value = false
    scrollToBottom()
  }
}
</script>