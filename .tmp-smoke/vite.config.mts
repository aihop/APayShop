import { defineConfig } from 'vite'
import path from 'node:path'
const APAY = '/Users/hugh/code/aihop/apay'
export default defineConfig({
  root: APAY,
  resolve: { alias: { '@qingpu-vendor': path.join(APAY, 'app/themes/qingpu/server/vendor') } },
})
