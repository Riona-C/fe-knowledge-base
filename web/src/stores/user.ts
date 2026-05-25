import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import router from '@/router'
import * as authApi from '@/api/auth'
import type { UserInfo } from '@/types'
import {
  getAccessToken,
  setAccessToken,
  getRefreshToken,
  setRefreshToken,
  clearTokens
} from '@/utils/auth'

export const useUserStore = defineStore('user', () => {
  const userInfo = ref<UserInfo | null>(null)
  const accessToken = ref<string | null>(getAccessToken())
  const refreshToken = ref<string | null>(getRefreshToken())

  const isLoggedIn = computed(() => !!accessToken.value)
  const isAdmin = computed(() => userInfo.value?.role === 'admin')

  async function login(username: string, password: string) {
    const data = await authApi.login({ username, password })
    accessToken.value = data.accessToken
    refreshToken.value = data.refreshToken
    setAccessToken(data.accessToken)
    setRefreshToken(data.refreshToken)
    await fetchUserInfo()
  }

  function logout() {
    userInfo.value = null
    accessToken.value = null
    refreshToken.value = null
    clearTokens()
    router.push('/login')
  }

  async function fetchUserInfo() {
    const data = await authApi.getUserInfo()
    userInfo.value = data
  }

  async function refreshAccessToken() {
    const token = refreshToken.value || getRefreshToken()
    if (!token) throw new Error('无刷新令牌')
    const data = await authApi.refreshToken({ refreshToken: token })
    accessToken.value = data.accessToken
    refreshToken.value = data.refreshToken
    setAccessToken(data.accessToken)
    setRefreshToken(data.refreshToken)
    return data.accessToken
  }

  return {
    userInfo,
    accessToken,
    refreshToken,
    isLoggedIn,
    isAdmin,
    login,
    logout,
    fetchUserInfo,
    refreshAccessToken
  }
})
