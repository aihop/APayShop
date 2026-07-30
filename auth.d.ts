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
  }
}

export {}
