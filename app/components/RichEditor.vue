<template>
  <div class="rich-editor border border-gray-800 rounded-lg overflow-hidden bg-[#121214]">
    <div
      v-if="editor"
      class="border-b border-gray-800 bg-gray-900/50 p-2 flex flex-wrap gap-2 items-center sticky top-0 z-10"
    >
      <UButton
        size="sm"
        variant="ghost"
        color="neutral"
        :class="{ 'bg-gray-800 text-white': editor.isActive('bold') }"
        @click="editor.chain().focus().toggleBold().run()"
        icon="ph:text-b-bold"
      />
      <UButton
        size="sm"
        variant="ghost"
        color="neutral"
        :class="{ 'bg-gray-800 text-white': editor.isActive('italic') }"
        @click="editor.chain().focus().toggleItalic().run()"
        icon="ph:text-italic-bold"
      />
      <UButton
        size="sm"
        variant="ghost"
        color="neutral"
        :class="{ 'bg-gray-800 text-white': editor.isActive('strike') }"
        @click="editor.chain().focus().toggleStrike().run()"
        icon="ph:text-strikethrough-bold"
      />

      <div class="w-px h-5 bg-gray-700 mx-1"></div>

      <UButton
        size="sm"
        variant="ghost"
        color="neutral"
        :class="{ 'bg-gray-800 text-white': editor.isActive('heading', { level: 1 }) }"
        @click="editor.chain().focus().toggleHeading({ level: 1 }).run()"
        icon="ph:text-h-one-bold"
      />
      <UButton
        size="sm"
        variant="ghost"
        color="neutral"
        :class="{ 'bg-gray-800 text-white': editor.isActive('heading', { level: 2 }) }"
        @click="editor.chain().focus().toggleHeading({ level: 2 }).run()"
        icon="ph:text-h-two-bold"
      />
      <UButton
        size="sm"
        variant="ghost"
        color="neutral"
        :class="{ 'bg-gray-800 text-white': editor.isActive('heading', { level: 3 }) }"
        @click="editor.chain().focus().toggleHeading({ level: 3 }).run()"
        icon="ph:text-h-three-bold"
      />

      <div class="w-px h-5 bg-gray-700 mx-1"></div>

      <UButton
        size="sm"
        variant="ghost"
        color="neutral"
        :class="{ 'bg-gray-800 text-white': editor.isActive('bulletList') }"
        @click="editor.chain().focus().toggleBulletList().run()"
        icon="ph:list-bullets-bold"
      />
      <UButton
        size="sm"
        variant="ghost"
        color="neutral"
        :class="{ 'bg-gray-800 text-white': editor.isActive('orderedList') }"
        @click="editor.chain().focus().toggleOrderedList().run()"
        icon="ph:list-numbers-bold"
      />
      <UButton
        size="sm"
        variant="ghost"
        color="neutral"
        :class="{ 'bg-gray-800 text-white': editor.isActive('blockquote') }"
        @click="editor.chain().focus().toggleBlockquote().run()"
        icon="ph:quotes-bold"
      />

      <div class="w-px h-5 bg-gray-700 mx-1"></div>

      <UButton
        size="sm"
        variant="ghost"
        color="neutral"
        @click="addImage"
        icon="ph:image-bold"
      />
      <UButton
        size="sm"
        variant="ghost"
        color="neutral"
        :class="{ 'bg-gray-800 text-white': editor.isActive('link') }"
        @click="setLink"
        icon="ph:link-bold"
      />
      <UButton
        v-if="editor.isActive('link')"
        size="sm"
        variant="ghost"
        color="error"
        @click="editor.chain().focus().unsetLink().run()"
        icon="ph:link-break-bold"
      />

      <div class="flex-1"></div>

      <UButton
        size="sm"
        variant="ghost"
        :color="showCode ? 'primary' : 'neutral'"
        :class="{ 'bg-gray-800 text-purple-400': showCode }"
        @click="toggleCodeView"
        icon="ph:code-bold"
        title="Toggle Source Code"
      />
    </div>

    <div class="p-4 min-h-[300px] text-white relative">
      <EditorContent
        v-show="!showCode"
        :editor="editor"
      />
      <textarea
        v-if="showCode"
        v-model="rawHtml"
        @input="updateFromRaw"
        class="absolute inset-0 w-full h-full p-4 bg-[#121214] text-gray-300 font-mono text-sm resize-none outline-none border-none focus:ring-0"
        placeholder="Enter HTML here..."
      ></textarea>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, shallowRef } from 'vue'
import { EditorContent } from '@tiptap/vue-3'

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const showCode = ref(false)
const rawHtml = ref(props.modelValue || '')
const editor = shallowRef<any>(null)

onMounted(async () => {
  // Dynamically import all Tiptap dependencies to avoid blocking initial render
  const [
    { Editor },
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
  ] = await Promise.all([
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
  ])

  editor.value = new Editor({
    content: props.modelValue || '',
    extensions: [
      Document,
      Paragraph,
      Text,
      Bold,
      Italic,
      Strike,
      Heading.configure({
        levels: [1, 2, 3],
      }),
      BulletList,
      OrderedList,
      ListItem,
      Blockquote,
      Image,
      Link.configure({
        openOnClick: false,
      }),
    ],
    editorProps: {
      attributes: {
        class: 'focus:outline-none min-h-[300px]',
      },
    },
    onUpdate: ({ editor: e }) => {
      const html = e.getHTML()
      rawHtml.value = html
      emit('update:modelValue', html)
    },
  })
})

const toggleCodeView = () => {
  if (!showCode.value && editor.value) {
    // Switching to code view, ensure rawHtml is up to date
    rawHtml.value = editor.value.getHTML() || ''
  }
  showCode.value = !showCode.value
}

const updateFromRaw = () => {
  emit('update:modelValue', rawHtml.value)
  // We don't set editor content here immediately while typing to avoid cursor jumping
  // It will be synced via the watcher
}

watch(
  () => props.modelValue,
  (value) => {
    const html = value || ''

    // Sync to rawHtml if not currently editing in code mode
    if (rawHtml.value !== html) {
      rawHtml.value = html
    }

    if (!editor.value) return

    const isSame = editor.value.getHTML() === html
    if (isSame) {
      return
    }
    editor.value.commands.setContent(html, { emitUpdate: false })
  }
)

onBeforeUnmount(() => {
  if (editor.value) {
    editor.value.destroy()
  }
})

const addImage = () => {
  const url = window.prompt('URL')
  if (url && editor.value) {
    editor.value.chain().focus().setImage({ src: url }).run()
  }
}

const setLink = () => {
  if (!editor.value) return
  const previousUrl = editor.value.getAttributes('link').href
  const url = window.prompt('URL', previousUrl)

  if (url === null) {
    return
  }

  if (url === '') {
    editor.value.chain().focus().extendMarkRange('link').unsetLink().run()
    return
  }

  editor.value
    .chain()
    .focus()
    .extendMarkRange('link')
    .setLink({ href: url })
    .run()
}
</script>

<style>
.rich-editor .ProseMirror {
  outline: none;
}
.rich-editor .ProseMirror p {
  margin-top: 0.5em;
  margin-bottom: 0.5em;
}
.rich-editor .ProseMirror h1 {
  font-size: 1.5em;
  font-weight: bold;
  margin-top: 1em;
  margin-bottom: 0.5em;
}
.rich-editor .ProseMirror h2 {
  font-size: 1.3em;
  font-weight: bold;
  margin-top: 1em;
  margin-bottom: 0.5em;
}
.rich-editor .ProseMirror h3 {
  font-size: 1.1em;
  font-weight: bold;
  margin-top: 1em;
  margin-bottom: 0.5em;
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
  border-left: 3px solid #4b5563;
  padding-left: 1em;
  color: #9ca3af;
  margin-top: 0.5em;
  margin-bottom: 0.5em;
}
.rich-editor .ProseMirror img {
  max-width: 100%;
  height: auto;
  border-radius: 0.375rem;
  margin-top: 1em;
  margin-bottom: 1em;
}
.rich-editor .ProseMirror a {
  color: #a855f7;
  text-decoration: underline;
}
.rich-editor .ProseMirror code {
  background-color: #374151;
  padding: 0.2em 0.4em;
  border-radius: 0.25rem;
  font-family: monospace;
}
.rich-editor .ProseMirror pre {
  background-color: #1f2937;
  padding: 1em;
  border-radius: 0.5rem;
  overflow-x: auto;
  font-family: monospace;
}
</style>
