export default defineEventHandler((event) => ({
  extension: 'example-tools',
  enabled: true,
  adminId: event.context.admin?.id ?? null,
  checkedAt: new Date().toISOString(),
}))
