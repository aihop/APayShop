<template>
  <div class="rich-editor border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden bg-white dark:bg-[#121214] flex flex-col shadow-xs">
    <!-- Header Toolbar -->
    <div class="border-b border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-900/60 p-2 flex flex-wrap gap-1.5 items-center justify-between sticky top-0 z-10 backdrop-blur-xs">
      <!-- Left: Contextual Formatting Buttons -->
      <div
        v-if="currentMode === 'visual' && editor"
        class="flex flex-wrap gap-1 items-center"
      >
        <!-- Text Styling -->
        <UButton
          size="xs"
          variant="ghost"
          color="neutral"
          :class="{ 'bg-gray-200 dark:bg-gray-800 text-purple-600 dark:text-purple-400': editor.isActive('bold') }"
          @click="editor.chain().focus().toggleBold().run()"
          icon="ph:text-b-bold"
          :title="$t('admin.editor.bold')"
        />
        <UButton
          size="xs"
          variant="ghost"
          color="neutral"
          :class="{ 'bg-gray-200 dark:bg-gray-800 text-purple-600 dark:text-purple-400': editor.isActive('italic') }"
          @click="editor.chain().focus().toggleItalic().run()"
          icon="ph:text-italic-bold"
          :title="$t('admin.editor.italic')"
        />
        <UButton
          size="xs"
          variant="ghost"
          color="neutral"
          :class="{ 'bg-gray-200 dark:bg-gray-800 text-purple-600 dark:text-purple-400': editor.isActive('strike') }"
          @click="editor.chain().focus().toggleStrike().run()"
          icon="ph:text-strikethrough-bold"
          :title="$t('admin.editor.strike')"
        />
        <UButton
          size="xs"
          variant="ghost"
          color="neutral"
          :class="{ 'bg-gray-200 dark:bg-gray-800 text-purple-600 dark:text-purple-400': editor.isActive('code') }"
          @click="editor.chain().focus().toggleCode().run()"
          icon="ph:code-bold"
          :title="$t('admin.editor.inlineCode')"
        />

        <div class="w-px h-4 bg-gray-300 dark:bg-gray-700 mx-0.5"></div>

        <!-- Headings -->
        <UButton
          size="xs"
          variant="ghost"
          color="neutral"
          :class="{ 'bg-gray-200 dark:bg-gray-800 text-purple-600 dark:text-purple-400': editor.isActive('heading', { level: 1 }) }"
          @click="editor.chain().focus().toggleHeading({ level: 1 }).run()"
          icon="ph:text-h-one-bold"
          :title="$t('admin.editor.heading1')"
        />
        <UButton
          size="xs"
          variant="ghost"
          color="neutral"
          :class="{ 'bg-gray-200 dark:bg-gray-800 text-purple-600 dark:text-purple-400': editor.isActive('heading', { level: 2 }) }"
          @click="editor.chain().focus().toggleHeading({ level: 2 }).run()"
          icon="ph:text-h-two-bold"
          :title="$t('admin.editor.heading2')"
        />
        <UButton
          size="xs"
          variant="ghost"
          color="neutral"
          :class="{ 'bg-gray-200 dark:bg-gray-800 text-purple-600 dark:text-purple-400': editor.isActive('heading', { level: 3 }) }"
          @click="editor.chain().focus().toggleHeading({ level: 3 }).run()"
          icon="ph:text-h-three-bold"
          :title="$t('admin.editor.heading3')"
        />

        <div class="w-px h-4 bg-gray-300 dark:bg-gray-700 mx-0.5"></div>

        <!-- Lists & Blocks -->
        <UButton
          size="xs"
          variant="ghost"
          color="neutral"
          :class="{ 'bg-gray-200 dark:bg-gray-800 text-purple-600 dark:text-purple-400': editor.isActive('bulletList') }"
          @click="editor.chain().focus().toggleBulletList().run()"
          icon="ph:list-bullets-bold"
          :title="$t('admin.editor.bulletList')"
        />
        <UButton
          size="xs"
          variant="ghost"
          color="neutral"
          :class="{ 'bg-gray-200 dark:bg-gray-800 text-purple-600 dark:text-purple-400': editor.isActive('orderedList') }"
          @click="editor.chain().focus().toggleOrderedList().run()"
          icon="ph:list-numbers-bold"
          :title="$t('admin.editor.orderedList')"
        />
        <UButton
          size="xs"
          variant="ghost"
          color="neutral"
          :class="{ 'bg-gray-200 dark:bg-gray-800 text-purple-600 dark:text-purple-400': editor.isActive('blockquote') }"
          @click="editor.chain().focus().toggleBlockquote().run()"
          icon="ph:quotes-bold"
          :title="$t('admin.editor.blockquote')"
        />
        <UButton
          size="xs"
          variant="ghost"
          color="neutral"
          :class="{ 'bg-gray-200 dark:bg-gray-800 text-purple-600 dark:text-purple-400': editor.isActive('codeBlock') }"
          @click="editor.chain().focus().toggleCodeBlock().run()"
          icon="ph:file-code-bold"
          :title="$t('admin.editor.codeBlock')"
        />
        <UButton
          size="xs"
          variant="ghost"
          color="neutral"
          @click="editor.chain().focus().setHorizontalRule().run()"
          icon="ph:minus-bold"
          :title="$t('admin.editor.horizontalRule')"
        />

        <div class="w-px h-4 bg-gray-300 dark:bg-gray-700 mx-0.5"></div>

        <!-- Links & Media -->
        <UButton
          size="xs"
          variant="ghost"
          color="neutral"
          :class="{ 'bg-gray-200 dark:bg-gray-800 text-purple-600 dark:text-purple-400': editor.isActive('link') }"
          @click="setLink"
          icon="ph:link-bold"
          :title="$t('admin.editor.link')"
        />
        <UButton
          v-if="editor.isActive('link')"
          size="xs"
          variant="ghost"
          color="error"
          @click="editor.chain().focus().unsetLink().run()"
          icon="ph:link-break-bold"
          :title="'Unset Link'"
        />
        <UButton
          size="xs"
          variant="ghost"
          color="neutral"
          @click="addImagePrompt"
          icon="ph:image-bold"
          :title="$t('admin.editor.image')"
        />
        <UButton
          size="xs"
          variant="ghost"
          color="neutral"
          :loading="isUploadingImage"
          @click="triggerImageUpload"
          icon="ph:upload-simple-bold"
          :title="$t('admin.editor.uploadImage')"
        />
      </div>

      <!-- Left: Markdown Mode Quick Formatting Toolbar -->
      <div
        v-else-if="currentMode === 'markdown'"
        class="flex flex-wrap gap-1 items-center"
      >
        <UButton
          size="xs"
          variant="ghost"
          color="neutral"
          @click="insertMarkdownSyntax('**', '**', 'bold text')"
          icon="ph:text-b-bold"
          :title="$t('admin.editor.bold')"
        />
        <UButton
          size="xs"
          variant="ghost"
          color="neutral"
          @click="insertMarkdownSyntax('*', '*', 'italic text')"
          icon="ph:text-italic-bold"
          :title="$t('admin.editor.italic')"
        />
        <UButton
          size="xs"
          variant="ghost"
          color="neutral"
          @click="insertMarkdownSyntax('~~', '~~', 'strikethrough')"
          icon="ph:text-strikethrough-bold"
          :title="$t('admin.editor.strike')"
        />
        <UButton
          size="xs"
          variant="ghost"
          color="neutral"
          @click="insertMarkdownSyntax('`', '`', 'code')"
          icon="ph:code-bold"
          :title="$t('admin.editor.inlineCode')"
        />

        <div class="w-px h-4 bg-gray-300 dark:bg-gray-700 mx-0.5"></div>

        <UButton
          size="xs"
          variant="ghost"
          color="neutral"
          @click="insertMarkdownLinePrefix('# ')"
          icon="ph:text-h-one-bold"
          :title="$t('admin.editor.heading1')"
        />
        <UButton
          size="xs"
          variant="ghost"
          color="neutral"
          @click="insertMarkdownLinePrefix('## ')"
          icon="ph:text-h-two-bold"
          :title="$t('admin.editor.heading2')"
        />
        <UButton
          size="xs"
          variant="ghost"
          color="neutral"
          @click="insertMarkdownLinePrefix('### ')"
          icon="ph:text-h-three-bold"
          :title="$t('admin.editor.heading3')"
        />

        <div class="w-px h-4 bg-gray-300 dark:bg-gray-700 mx-0.5"></div>

        <UButton
          size="xs"
          variant="ghost"
          color="neutral"
          @click="insertMarkdownLinePrefix('- ')"
          icon="ph:list-bullets-bold"
          :title="$t('admin.editor.bulletList')"
        />
        <UButton
          size="xs"
          variant="ghost"
          color="neutral"
          @click="insertMarkdownLinePrefix('1. ')"
          icon="ph:list-numbers-bold"
          :title="$t('admin.editor.orderedList')"
        />
        <UButton
          size="xs"
          variant="ghost"
          color="neutral"
          @click="insertMarkdownLinePrefix('> ')"
          icon="ph:quotes-bold"
          :title="$t('admin.editor.blockquote')"
        />
        <UButton
          size="xs"
          variant="ghost"
          color="neutral"
          @click="insertMarkdownSyntax('```ts\n', '\n```', 'console.log(\'hello\');')"
          icon="ph:file-code-bold"
          :title="$t('admin.editor.codeBlock')"
        />
        <UButton
          size="xs"
          variant="ghost"
          color="neutral"
          @click="insertMarkdownTable"
          icon="ph:table-bold"
          :title="$t('admin.editor.table')"
        />
        <UButton
          size="xs"
          variant="ghost"
          color="neutral"
          @click="insertMarkdownLinePrefix('---\n')"
          icon="ph:minus-bold"
          :title="$t('admin.editor.horizontalRule')"
        />

        <div class="w-px h-4 bg-gray-300 dark:bg-gray-700 mx-0.5"></div>

        <UButton
          size="xs"
          variant="ghost"
          color="neutral"
          @click="insertMarkdownLink"
          icon="ph:link-bold"
          :title="$t('admin.editor.link')"
        />
        <UButton
          size="xs"
          variant="ghost"
          color="neutral"
          @click="addImagePrompt"
          icon="ph:image-bold"
          :title="$t('admin.editor.image')"
        />
        <UButton
          size="xs"
          variant="ghost"
          color="neutral"
          :loading="isUploadingImage"
          @click="triggerImageUpload"
          icon="ph:upload-simple-bold"
          :title="$t('admin.editor.uploadImage')"
        />
      </div>

      <!-- Left: HTML Mode Toolbar Placeholder -->
      <div
        v-else
        class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 font-mono px-1"
      >
        <UIcon
          name="ph:code-bold"
          class="w-4 h-4 text-purple-500"
        />
        <span>HTML Source Mode</span>
      </div>

      <!-- Right: Mode Switcher & Tools -->
      <div class="flex items-center gap-2">
        <!-- Markdown Live Split Preview Toggle -->
        <UButton
          v-if="currentMode === 'markdown'"
          size="xs"
          :variant="splitPreview ? 'soft' : 'ghost'"
          :color="splitPreview ? 'primary' : 'neutral'"
          @click="splitPreview = !splitPreview"
          icon="ph:columns-bold"
          :title="$t('admin.editor.splitPreview')"
        >
          <span class="hidden sm:inline text-xs">{{ $t('admin.editor.splitPreview') }}</span>
        </UButton>

        <div class="w-px h-4 bg-gray-300 dark:bg-gray-700 mx-0.5"></div>

        <!-- Mode Switcher Tabs -->
        <div class="flex items-center bg-gray-200/80 dark:bg-gray-800/80 rounded-lg p-0.5 gap-0.5">
          <button
            type="button"
            @click="switchMode('visual')"
            :class="[
              'px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1',
              currentMode === 'visual'
                ? 'bg-white dark:bg-[#18181b] text-purple-600 dark:text-purple-400 shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            ]"
            :title="$t('admin.editor.visual')"
          >
            <UIcon
              name="ph:paint-brush-broad"
              class="w-3.5 h-3.5"
            />
            <span class="hidden sm:inline">{{ $t('admin.editor.visual') }}</span>
          </button>

          <button
            type="button"
            @click="switchMode('markdown')"
            :class="[
              'px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1',
              currentMode === 'markdown'
                ? 'bg-white dark:bg-[#18181b] text-purple-600 dark:text-purple-400 shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            ]"
            :title="$t('admin.editor.markdown')"
          >
            <UIcon
              name="ph:markdown-logo"
              class="w-3.5 h-3.5"
            />
            <span class="hidden sm:inline">{{ $t('admin.editor.markdown') }}</span>
          </button>

          <button
            type="button"
            @click="switchMode('html')"
            :class="[
              'px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1',
              currentMode === 'html'
                ? 'bg-white dark:bg-[#18181b] text-purple-600 dark:text-purple-400 shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            ]"
            :title="$t('admin.editor.html')"
          >
            <UIcon
              name="ph:code"
              class="w-3.5 h-3.5"
            />
            <span class="hidden sm:inline">{{ $t('admin.editor.html') }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Hidden File Input for Image Upload -->
    <input
      type="file"
      ref="fileInputRef"
      class="hidden"
      accept="image/png, image/jpeg, image/webp, image/gif"
      @change="handleFileUpload"
    />

    <!-- Editor Body -->
    <div class="relative min-h-[360px] flex-1 flex flex-col">
      <!-- 1. Visual WYSIWYG Editor -->
      <div
        v-show="currentMode === 'visual'"
        class="p-4 min-h-[360px] text-gray-900 dark:text-white flex-1 overflow-y-auto"
      >
        <component
          :is="EditorContentComponent"
          v-if="EditorContentComponent && editor"
          :editor="editor"
        />
        <div v-else class="h-full flex items-center justify-center text-xs text-gray-400 py-12">
          加载编辑器中...
        </div>
      </div>

      <!-- 2. Markdown Editor (with optional Split Preview) -->
      <div
        v-if="currentMode === 'markdown'"
        class="flex-1 grid min-h-[360px]"
        :class="splitPreview ? 'grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-200 dark:divide-gray-800' : 'grid-cols-1'"
      >
        <!-- Markdown Input Area -->
        <div class="flex flex-col h-full bg-gray-50/50 dark:bg-gray-900/30">
          <textarea
            ref="markdownTextareaRef"
            v-model="rawMarkdown"
            @input="onMarkdownInput"
            @keydown.tab.prevent="handleMarkdownTab"
            class="w-full h-full min-h-[360px] p-4 bg-transparent text-gray-800 dark:text-gray-200 font-mono text-sm resize-none outline-hidden border-none focus:ring-0 leading-relaxed"
            :placeholder="$t('admin.editor.markdownPlaceholder')"
          ></textarea>
        </div>

        <!-- Markdown Live Split Preview Area -->
        <div
          v-if="splitPreview"
          class="p-4 min-h-[360px] max-h-[600px] overflow-y-auto bg-white dark:bg-[#121214]"
        >
          <div
            v-if="compiledMarkdownHtml"
            class="prose prose-sm dark:prose-invert prose-purple max-w-none break-words"
            v-html="compiledMarkdownHtml"
          ></div>
          <div
            v-else
            class="h-full flex items-center justify-center text-xs text-gray-400 dark:text-gray-500 italic py-12"
          >
            {{ $t('admin.editor.previewEmpty') }}
          </div>
        </div>
      </div>

      <!-- 3. HTML Source Editor -->
      <div
        v-if="currentMode === 'html'"
        class="flex-1 bg-gray-50/50 dark:bg-gray-900/30 min-h-[360px]"
      >
        <textarea
          v-model="rawHtml"
          @input="onHtmlInput"
          class="w-full h-full min-h-[360px] p-4 bg-transparent text-gray-800 dark:text-gray-200 font-mono text-sm resize-none outline-hidden border-none focus:ring-0 leading-relaxed"
          :placeholder="$t('admin.editor.htmlPlaceholder')"
        ></textarea>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, shallowRef, nextTick } from 'vue'
import { markdownToHtml, htmlToMarkdown, isMarkdownContent } from '~/utils/markdown'

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const toast = useToast()
const { t } = useI18n()

type EditorMode = 'visual' | 'markdown' | 'html'
const currentMode = ref<EditorMode>('visual')
const splitPreview = ref(true)

const rawHtml = ref(props.modelValue || '')
const rawMarkdown = ref(htmlToMarkdown(props.modelValue || ''))
const compiledMarkdownHtml = computed(() => markdownToHtml(rawMarkdown.value))

const editor = shallowRef<any>(null)
const EditorContentComponent = shallowRef<any>(null)
const markdownTextareaRef = ref<HTMLTextAreaElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const isUploadingImage = ref(false)

onMounted(async () => {
  // Dynamically import all Tiptap dependencies to keep initial bundle light
  const [
    { EditorContent },
    { Editor, Node, textblockTypeInputRule, nodeInputRule },
    { default: Document },
    { default: Paragraph },
    { default: Text },
    { default: Bold },
    { default: Italic },
    { default: Strike },
    { default: Heading },
    { default: BulletList },
    { default: OrderedList },
    { default: ListItem },
    { default: Blockquote },
    { default: Image },
    { default: Link },
    { default: Code },
  ] = await Promise.all([
    import('@tiptap/vue-3'),
    import('@tiptap/core'),
    import('@tiptap/extension-document'),
    import('@tiptap/extension-paragraph'),
    import('@tiptap/extension-text'),
    import('@tiptap/extension-bold'),
    import('@tiptap/extension-italic'),
    import('@tiptap/extension-strike'),
    import('@tiptap/extension-heading'),
    import('@tiptap/extension-bullet-list'),
    import('@tiptap/extension-ordered-list'),
    import('@tiptap/extension-list-item'),
    import('@tiptap/extension-blockquote'),
    import('@tiptap/extension-image'),
    import('@tiptap/extension-link'),
    import('@tiptap/extension-code'),
  ])

  EditorContentComponent.value = EditorContent

  // Custom CodeBlock Node with markdown input rules (```lang)
  const CodeBlock = Node.create({
    name: 'codeBlock',
    content: 'text*',
    marks: '',
    group: 'block',
    code: true,
    defining: true,
    parseHTML() {
      return [{ tag: 'pre', preserveWhitespace: 'full' }]
    },
    renderHTML({ HTMLAttributes }) {
      return ['pre', HTMLAttributes, ['code', 0]]
    },
    addCommands() {
      return {
        setCodeBlock: () => ({ commands }: any) => commands.setNode(this.name),
        toggleCodeBlock: () => ({ commands }: any) => commands.toggleNode(this.name, 'paragraph'),
      }
    },
    addKeyboardShortcuts() {
      return {
        'Mod-Alt-c': () => this.editor.commands.toggleCodeBlock(),
      }
    },
    addInputRules() {
      return [
        textblockTypeInputRule({
          find: /^```([a-z0-9_-]*)\s$/,
          type: this.type,
        }),
      ]
    },
  })

  // Custom HorizontalRule Node with markdown input rules (---)
  const HorizontalRule = Node.create({
    name: 'horizontalRule',
    group: 'block',
    parseHTML() {
      return [{ tag: 'hr' }]
    },
    renderHTML({ HTMLAttributes }) {
      return ['hr', HTMLAttributes]
    },
    addCommands() {
      return {
        setHorizontalRule: () => ({ chain }: any) => {
          return chain()
            .insertContent({ type: this.name })
            .run()
        },
      }
    },
    addInputRules() {
      return [
        nodeInputRule({
          find: /^(?:---|—-|___\s*|\*\*\*\s*)$/,
          type: this.type,
        }),
      ]
    },
  })

  editor.value = new Editor({
    content: props.modelValue || '',
    extensions: [
      Document,
      Paragraph,
      Text,
      Bold,
      Italic,
      Strike,
      Code,
      Heading.configure({
        levels: [1, 2, 3, 4, 5, 6],
      }),
      BulletList,
      OrderedList,
      ListItem,
      Blockquote,
      Image,
      Link.configure({
        openOnClick: false,
      }),
      CodeBlock,
      HorizontalRule,
    ],
    editorProps: {
      attributes: {
        class: 'focus:outline-none min-h-[300px]',
      },
      // Smart Markdown Paste Handler
      handlePaste: (view, event) => {
        const text = event.clipboardData?.getData('text/plain')
        if (text && isMarkdownContent(text) && text.trim().length > 3) {
          try {
            const html = markdownToHtml(text)
            if (html) {
              editor.value.commands.insertContent(html)
              return true
            }
          } catch (e) {
            console.warn('Smart markdown paste parse failed, falling back to default paste:', e)
          }
        }
        return false
      },
    },
    onUpdate: ({ editor: e }) => {
      const html = e.getHTML()
      rawHtml.value = html
      if (currentMode.value === 'visual') {
        emit('update:modelValue', html)
      }
    },
  })
})

const switchMode = (mode: EditorMode) => {
  if (currentMode.value === mode) return

  const prevMode = currentMode.value

  // Synchronize values when switching
  if (prevMode === 'visual') {
    const currentHtml = editor.value ? editor.value.getHTML() : props.modelValue || ''
    rawHtml.value = currentHtml
    rawMarkdown.value = htmlToMarkdown(currentHtml)
  } else if (prevMode === 'markdown') {
    const compiled = markdownToHtml(rawMarkdown.value)
    rawHtml.value = compiled
    if (editor.value) {
      editor.value.commands.setContent(compiled, { emitUpdate: false })
    }
  } else if (prevMode === 'html') {
    rawMarkdown.value = htmlToMarkdown(rawHtml.value)
    if (editor.value) {
      editor.value.commands.setContent(rawHtml.value, { emitUpdate: false })
    }
  }

  currentMode.value = mode

  // If entering visual mode, update editor content
  if (mode === 'visual' && editor.value) {
    const targetHtml = prevMode === 'markdown' ? markdownToHtml(rawMarkdown.value) : rawHtml.value
    editor.value.commands.setContent(targetHtml, { emitUpdate: false })
  }
}

const onMarkdownInput = () => {
  const html = markdownToHtml(rawMarkdown.value)
  rawHtml.value = html
  emit('update:modelValue', html)
}

const onHtmlInput = () => {
  emit('update:modelValue', rawHtml.value)
}

// Watch external modelValue changes
watch(
  () => props.modelValue,
  (value) => {
    const html = value || ''

    if (currentMode.value === 'visual') {
      if (editor.value && editor.value.getHTML() !== html) {
        editor.value.commands.setContent(html, { emitUpdate: false })
      }
      rawHtml.value = html
    } else if (currentMode.value === 'markdown') {
      const compiled = markdownToHtml(rawMarkdown.value)
      if (compiled !== html) {
        rawMarkdown.value = htmlToMarkdown(html)
      }
    } else if (currentMode.value === 'html') {
      if (rawHtml.value !== html) {
        rawHtml.value = html
      }
    }
  },
)

onBeforeUnmount(() => {
  if (editor.value) {
    editor.value.destroy()
  }
})

// Tab key in Markdown textarea inserts 2 spaces
const handleMarkdownTab = (e: KeyboardEvent) => {
  const textarea = markdownTextareaRef.value
  if (!textarea) return

  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const value = rawMarkdown.value

  rawMarkdown.value = value.substring(0, start) + '  ' + value.substring(end)

  nextTick(() => {
    textarea.selectionStart = textarea.selectionEnd = start + 2
    onMarkdownInput()
  })
}

// Markdown Quick Actions
const insertMarkdownSyntax = (prefix: string, suffix: string, defaultText: string) => {
  const textarea = markdownTextareaRef.value
  if (!textarea) return

  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const selectedText = rawMarkdown.value.substring(start, end)
  const insertText = selectedText || defaultText

  const newText =
    rawMarkdown.value.substring(0, start) +
    prefix +
    insertText +
    suffix +
    rawMarkdown.value.substring(end)

  rawMarkdown.value = newText

  nextTick(() => {
    textarea.focus()
    textarea.selectionStart = start + prefix.length
    textarea.selectionEnd = start + prefix.length + insertText.length
    onMarkdownInput()
  })
}

const insertMarkdownLinePrefix = (prefix: string) => {
  const textarea = markdownTextareaRef.value
  if (!textarea) return

  const start = textarea.selectionStart
  const value = rawMarkdown.value

  // Find start of current line
  const lineStart = value.lastIndexOf('\n', start - 1) + 1

  rawMarkdown.value = value.substring(0, lineStart) + prefix + value.substring(lineStart)

  nextTick(() => {
    textarea.focus()
    textarea.selectionStart = textarea.selectionEnd = start + prefix.length
    onMarkdownInput()
  })
}

const insertMarkdownTable = () => {
  const tableTemplate = '\n| Header 1 | Header 2 |\n| --- | --- |\n| Cell 1 | Cell 2 |\n\n'
  insertMarkdownSyntax('', '', tableTemplate.trim())
}

const insertMarkdownLink = () => {
  const url = window.prompt(t('admin.editor.linkPrompt'), 'https://')
  if (url) {
    insertMarkdownSyntax('[', `](${url})`, 'Link Text')
  }
}

// Links and Images
const setLink = () => {
  if (!editor.value) return
  const previousUrl = editor.value.getAttributes('link').href
  const url = window.prompt(t('admin.editor.linkPrompt'), previousUrl || 'https://')

  if (url === null) return

  if (url === '') {
    editor.value.chain().focus().extendMarkRange('link').unsetLink().run()
    return
  }

  editor.value.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
}

const addImagePrompt = () => {
  const url = window.prompt(t('admin.editor.urlPrompt'), 'https://')
  if (!url) return

  if (currentMode.value === 'visual' && editor.value) {
    editor.value.chain().focus().setImage({ src: url }).run()
  } else if (currentMode.value === 'markdown') {
    insertMarkdownSyntax('![Image](', `${url})`, '')
  } else {
    rawHtml.value += `\n<img src="${url}" alt="image" />`
    onHtmlInput()
  }
}

const triggerImageUpload = () => {
  if (fileInputRef.value) {
    fileInputRef.value.click()
  }
}

const handleFileUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const files = target.files
  if (!files || files.length === 0) return

  isUploadingImage.value = true
  try {
    const formData = new FormData()
    formData.append('files', files[0]!)

    const res: any = await $fetch('/api/admin/upload', {
      method: 'POST',
      body: formData,
    })

    if (res && res.urls && res.urls.length > 0) {
      const url = res.urls[0]
      if (currentMode.value === 'visual' && editor.value) {
        editor.value.chain().focus().setImage({ src: url }).run()
      } else if (currentMode.value === 'markdown') {
        insertMarkdownSyntax('![Uploaded Image](', `${url})`, '')
      } else {
        rawHtml.value += `\n<img src="${url}" alt="uploaded image" />`
        onHtmlInput()
      }
      toast.add({ title: 'Success', description: t('admin.editor.uploadSuccess'), color: 'success' })
    }
  } catch (error) {
    toast.add({ title: 'Error', description: t('admin.editor.uploadFailed'), color: 'error' })
    console.error(error)
  } finally {
    isUploadingImage.value = false
    if (fileInputRef.value) fileInputRef.value.value = ''
  }
}
</script>

<style>
.rich-editor .ProseMirror {
  outline: none;
  min-height: 300px;
}
.rich-editor .ProseMirror p {
  margin-top: 0.5em;
  margin-bottom: 0.5em;
  line-height: 1.625;
}
.rich-editor .ProseMirror h1 {
  font-size: 1.75em;
  font-weight: 700;
  margin-top: 1.25em;
  margin-bottom: 0.5em;
  line-height: 1.3;
}
.rich-editor .ProseMirror h2 {
  font-size: 1.4em;
  font-weight: 700;
  margin-top: 1.1em;
  margin-bottom: 0.5em;
  line-height: 1.35;
}
.rich-editor .ProseMirror h3 {
  font-size: 1.2em;
  font-weight: 600;
  margin-top: 1em;
  margin-bottom: 0.4em;
  line-height: 1.4;
}
.rich-editor .ProseMirror ul {
  list-style-type: disc;
  padding-left: 1.5em;
  margin-top: 0.5em;
  margin-bottom: 0.5em;
}
.rich-editor .ProseMirror ol {
  list-style-type: decimal;
  padding-left: 1.5em;
  margin-top: 0.5em;
  margin-bottom: 0.5em;
}
.rich-editor .ProseMirror blockquote {
  border-left: 4px solid #a855f7;
  padding-left: 1em;
  color: #6b7280;
  background-color: rgba(168, 85, 247, 0.05);
  padding-top: 0.25em;
  padding-bottom: 0.25em;
  border-radius: 0 0.375rem 0.375rem 0;
  margin-top: 0.75em;
  margin-bottom: 0.75em;
}
.dark .rich-editor .ProseMirror blockquote {
  border-left-color: #a855f7;
  color: #9ca3af;
  background-color: rgba(168, 85, 247, 0.1);
}
.rich-editor .ProseMirror img {
  max-width: 100%;
  height: auto;
  border-radius: 0.5rem;
  margin-top: 1em;
  margin-bottom: 1em;
  border: 1px solid rgba(156, 163, 175, 0.2);
}
.rich-editor .ProseMirror a {
  color: #a855f7;
  text-decoration: underline;
}
.rich-editor .ProseMirror code {
  background-color: #f3f4f6;
  color: #db2777;
  padding: 0.2em 0.4em;
  border-radius: 0.25rem;
  font-family: monospace;
  font-size: 0.9em;
}
.dark .rich-editor .ProseMirror code {
  background-color: #27272a;
  color: #f472b6;
}
.rich-editor .ProseMirror pre {
  background-color: #18181b;
  color: #f4f4f5;
  padding: 1em;
  border-radius: 0.5rem;
  overflow-x: auto;
  font-family: monospace;
  font-size: 0.875em;
  margin-top: 0.75em;
  margin-bottom: 0.75em;
}
.rich-editor .ProseMirror pre code {
  background-color: transparent;
  color: inherit;
  padding: 0;
  border-radius: 0;
}
.rich-editor .ProseMirror hr {
  border: none;
  border-top: 1px solid #e5e7eb;
  margin-top: 1.5em;
  margin-bottom: 1.5em;
}
.dark .rich-editor .ProseMirror hr {
  border-top-color: #27272a;
}
</style>
