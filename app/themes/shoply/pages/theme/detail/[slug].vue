<script setup lang="ts">
const route = useRoute()
const { localePath } = useLocaleRouter()
const value = route.params.slug
const slug = Array.isArray(value) ? String(value.at(-1) || '') : String(value || '')

await navigateTo(localePath(`/theme/${slug}`), { replace: true, redirectCode: 301 })
</script>
