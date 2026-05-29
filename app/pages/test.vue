<template>
  <div>
    <h1>Test</h1>
    <pre>{{ Object.keys(modules) }}</pre>
  </div>
</template>
<script setup>
const modules = import.meta.glob('../themes/**/pages/**/*.vue', {
  eager: true,
  import: 'default',
})
</script>
