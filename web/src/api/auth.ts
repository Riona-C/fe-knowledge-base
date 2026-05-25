import request from '@/utils/request'
import type { UserInfo } from '@/types'

export const login = (data: { username: string; password: string }) =>
  request.post<{ accessToken: string; refreshToken: string }>('/auth/login', data)

export const refreshToken = (data: { refreshToken: string }) =>
  request.post<{ accessToken: string; refreshToken: string }>('/auth/refresh', data)

export const getUserInfo = () => request.get<UserInfo>('/auth/info')

export const changePassword = (data: { oldPassword: string; newPassword: string }) =>
  request.put('/auth/password', data)
