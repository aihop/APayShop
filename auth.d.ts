declare module '#auth-utils' {
  interface User {
    id: number | string
    email: string
    nickname?: string | null
    nickName?: string | null
    avatarUrl?: string | null
    avatar?: string | null
  }

  interface UserSession {
    admin?: {
      id: number | string
      username: string
      role: string
      permissions?: string[]
    } | null
    sessionId?: string
    loggedInAt?: Date | string
    /**
     * 委派会话:会话背后的操作者不是 user 本人,而是被授权代表其操作的第三方
     * (由主题定义具体是谁,核心不关心)。
     *
     * 「禁止多设备登录」按 users.currentSessionId 逐用户判活,委派会话共用同一
     * 个 user 行,套用该检查会让多个委派者互踢或被整体清除,因此整体豁免。
     * 委派者自身的启停由签发方负责逐请求复核。
     */
    delegated?: boolean
  }
}

export {}
