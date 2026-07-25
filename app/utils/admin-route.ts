// admin 路由判定单点:此前 normalizeAdminPath + startsWith('/admin') 在
// layout/header/mobile-menu/middleware/plugin 里各抄一份(6 处),边界条件
// (语言前缀归一、公开页排除)必须处处一致,极易漂移。
// 注意:各消费方的"排除集"语义本就不同——鉴权中间件放行 login+setup,
// 访客统计排除全部 /admin——所以这里只收口两个公共事实(归一化、前缀判定),
// 排除集留给调用方自己表达,不做一刀切。

/** 去掉 /zh、/en-us 这类 i18n 语言前缀,得到与路由表对齐的路径 */
export const stripLocalePrefix = (path: string) =>
  path.replace(/^\/[a-z]{2}(?:-[a-z]{2})?(?=\/)/i, '')

/** 该路径是否落在 /admin 命名空间(含 login/setup 等公开页) */
export const isAdminPath = (path: string) =>
  stripLocalePrefix(path).startsWith('/admin')
