<script setup lang="ts">
import { definePageMeta, navigateTo } from '#imports'

definePageMeta({
  layout: false,
  middleware: () => navigateTo('/admin/dashboard', { redirectCode: 301 }),
})
</script>
