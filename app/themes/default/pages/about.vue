<template>
  <div class="min-h-screen bg-[#09090b]">
    <div class="max-w-[1440px] mx-auto w-full">
      <!-- Hero Section -->
      <div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-16 overflow-hidden">
        <!-- Background Effects -->
        <div class="absolute inset-0 pointer-events-none">
          <div class="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-purple-600/10 rounded-full blur-[120px] opacity-50"></div>
        </div>

        <div class="relative z-10 text-center mb-16">
          <h1 class="text-4xl md:text-5xl font-sans font-bold mb-4">
            <span class="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
              About Us
            </span>
          </h1>
          <p class="text-gray-400 text-lg max-w-2xl mx-auto mt-6">
            Discover the story, vision, and mission of {{ getSetting('company_name') || 'Your Company' }}
          </p>
        </div>
      </div>

      <!-- Main Content -->

      <div class="grid gap-20 px-4 sm:px-6">
        <!-- Brand Story & Values Grid -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          <div>
            <h2 class="text-3xl font-sans font-bold text-white mb-6">{{ getSetting('company_name') || 'Your Company' }}</h2>
            <p class="text-gray-300 leading-relaxed mb-8">
              Leveraging cutting-edge artificial intelligence technology to create creative and emotionally resonant short drama works, bringing audiences a brand new audiovisual experience.
            </p>

            <div class="space-y-8">
              <div class="flex items-start space-x-4">
                <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg mr-3">
                  <Icon
                    name="ph:target"
                    class="w-5 h-5 text-white"
                  />
                </div>
                <div>
                  <h3 class="text-white font-medium mb-1">Our Mission</h3>
                  <p class="text-gray-400 text-sm leading-relaxed">Revolutionizing short drama creation with AI technology, bringing new content experiences to global audiences</p>
                </div>
              </div>

              <div class="flex items-start space-x-4">
                <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg">
                  <Icon
                    name="ph:eye"
                    class="w-5 h-5 text-white"
                  />
                </div>
                <div>
                  <h3 class="text-white font-medium mb-1">Our Vision</h3>
                  <p class="text-gray-400 text-sm leading-relaxed">To become the world's leading AI short drama content creation platform</p>
                </div>
              </div>

              <div class="flex items-start space-x-4">
                <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg">
                  <Icon
                    name="ph:diamond"
                    class="w-5 h-5 text-white"
                  />
                </div>
                <div>
                  <h3 class="text-white font-medium mb-1">Our Values</h3>
                  <p class="text-gray-400 text-sm leading-relaxed">Innovation, Quality, User-First, Continuous Evolution</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Image & Floating Badge -->
          <div class="relative z-10">
            <div class="aspect-square rounded-2xl overflow-hidden bg-white/5 backdrop-blur-md border border-white/10 p-2 shadow-2xl">
              <img
                src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&h=800&fit=crop"
                alt="Team collaboration"
                class="w-full h-full object-cover rounded-xl"
              />
            </div>

            <div class="absolute -bottom-6 -left-6 md:-left-10 bg-[#121214]/90 backdrop-blur-xl border border-gray-800 shadow-[0_0_30px_rgba(168,85,247,0.2)] p-4 rounded-xl max-w-xs z-10">
              <div class="flex items-center space-x-3">
                <div class="w-12 h-12 rounded-full bg-gradient-to-tr from-orange-400 to-rose-500 flex items-center justify-center shrink-0">
                  <Icon
                    name="ph:medal-fill"
                    class="w-6 h-6 text-white"
                  />
                </div>
                <div>
                  <p class="text-white font-semibold">Industry Leader</p>
                  <p class="text-gray-400 text-sm">AI Short Drama Innovation</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Company Info -->
        <div class="bg-[#121214] border border-gray-800/50 rounded-3xl p-8 md:p-12 relative z-10">
          <div class="text-center mb-10">
            <h2 class="text-3xl font-bold text-white mb-4">Company Details</h2>
            <p class="text-gray-400">Everything you need to know about our organization</p>
          </div>

          <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <div class="text-center">
              <div class="w-12 h-12 mx-auto rounded-full bg-gray-800 flex items-center justify-center mb-4">
                <Icon
                  name="ph:buildings"
                  class="w-6 h-6 text-gray-300"
                />
              </div>
              <h4 class="text-sm font-medium text-gray-500 mb-1 uppercase tracking-wider">Company</h4>
              <p class="text-white font-medium">{{ getSetting('company_name') }}</p>
            </div>

            <div class="text-center">
              <div class="w-12 h-12 mx-auto rounded-full bg-gray-800 flex items-center justify-center mb-4">
                <Icon
                  name="ph:map-pin"
                  class="w-6 h-6 text-gray-300"
                />
              </div>
              <h4 class="text-sm font-medium text-gray-500 mb-1 uppercase tracking-wider">Location</h4>
              <p class="text-white font-medium">{{ getSetting('company_address') || 'Global Remote' }}</p>
            </div>

            <div class="text-center">
              <div class="w-12 h-12 mx-auto rounded-full bg-gray-800 flex items-center justify-center mb-4">
                <Icon
                  name="ph:envelope-simple"
                  class="w-6 h-6 text-gray-300"
                />
              </div>
              <h4 class="text-sm font-medium text-gray-500 mb-1 uppercase tracking-wider">Support</h4>
              <p class="text-white font-medium">{{ getSetting('support_email') }}</p>
            </div>

            <div class="text-center">
              <div class="w-12 h-12 mx-auto rounded-full bg-gray-800 flex items-center justify-center mb-4">
                <Icon
                  name="ph:phone"
                  class="w-6 h-6 text-gray-300"
                />
              </div>
              <h4 class="text-sm font-medium text-gray-500 mb-1 uppercase tracking-wider">Phone</h4>
              <p class="text-white font-medium">{{ getSetting('company_phone') || 'Available via Email' }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

</template>

<script setup lang="ts">
const { getSetting } = useSettings()

definePageMeta({
  title: 'About Us',
})

const coreValues = [
  {
    title: 'Innovation First',
    description:
      'We constantly push the boundaries of what is possible, embracing new technologies and methodologies to deliver state-of-the-art solutions.',
    icon: 'ph:lightbulb-fill',
    color: 'purple',
  },
  {
    title: 'Quality Driven',
    description:
      'Excellence is not an option; it is our standard. Every product we release goes through rigorous testing and refinement to ensure perfection.',
    icon: 'ph:medal-fill',
    color: 'blue',
  },
  {
    title: 'User Centric',
    description:
      'Our users are at the heart of everything we do. We design with empathy, build with purpose, and support with dedication.',
    icon: 'ph:users-three-fill',
    color: 'emerald',
  },
]
</script>