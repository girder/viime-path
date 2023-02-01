<script setup lang="ts">
import PathwayEditor from './components/PathwayEditor.vue'
</script>

<template>
  <Suspense>
    <PathwayEditor />
    <template #fallback>Loading...</template>
  </Suspense>
</template>
