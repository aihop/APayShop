<template>
  <footer class="mt-20 border-t border-gray-200/80 py-12 dark:border-gray-800/50">
    <div class="max-w-7xl mx-auto px-4">
      <div class="flex flex-col md:flex-row items-center justify-between">
        <p class="text-sm leading-6 text-gray-500 dark:text-gray-500">
          &copy; {{ new Date().getFullYear() }} {{ getSetting('site_name') || 'Your Site' }}. All rights reserved.
          <span class="ml-1">Designed & Developed by <a
              href="https://apay.run/"
              target="_blank"
              class="text-gray-600 transition-colors hover:text-purple-500 dark:text-gray-400 dark:hover:text-purple-400"
            >APay</a></span>
        </p>
        <div class="flex items-center space-x-4 mt-4 md:mt-0">
          <a
            href="#"
            class="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-all duration-300 hover:bg-gray-200 hover:text-gray-900 dark:bg-white/5 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
            aria-label="Twitter"
          >
            <Icon
              name="ph:twitter-logo-fill"
              class="w-4 h-4"
            />
          </a>
          <a
            href="#"
            class="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-all duration-300 hover:bg-gray-200 hover:text-gray-900 dark:bg-white/5 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
            aria-label="LinkedIn"
          >
            <Icon
              name="ph:linkedin-logo-fill"
              class="w-4 h-4"
            />
          </a>
          <a
            href="#"
            class="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-all duration-300 hover:bg-gray-200 hover:text-gray-900 dark:bg-white/5 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
            aria-label="YouTube"
          >
            <Icon
              name="ph:youtube-logo-fill"
              class="w-4 h-4"
            />
          </a>
          <a
            href="#"
            class="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-all duration-300 hover:bg-gray-200 hover:text-gray-900 dark:bg-white/5 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
            aria-label="GitHub"
          >
            <Icon
              name="ph:github-logo-fill"
              class="w-4 h-4"
            />
          </a>
        </div>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
const { getSetting } = useSettings()
</script>
