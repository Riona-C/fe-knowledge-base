import request from '@/utils/request'
import type { UserInfo, PageResponse } from '@/types'

export interface UserListParams {
  keyword?: string
  page?: number
  pageSize?: number
}

export const getUserList = (params: UserListParams) =>
  request.get<PageResponse<UserInfo>>('/user/list', { params })

export const createUser = (data: Partial<UserInfo> & { password?: string }) =>
  request.post('/user', data)

export const updateUser = (id: number, data: Partial<UserInfo> & { password?: string }) =>
  request.put(`/user/${id}`, data)

export const deleteUser = (id: number) => request.delete(`/user/${id}`)
