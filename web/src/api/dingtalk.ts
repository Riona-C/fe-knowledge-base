import request from '@/utils/request'
import type { AutoDetectConfig, DingtalkConfig, DingtalkMessage, PageResponse } from '@/types'

export const getDingtalkConfig = () => request.get<DingtalkConfig>('/dingtalk/config')

export const updateDingtalkConfig = (data: Partial<DingtalkConfig>) =>
  request.put('/dingtalk/config', data)

export interface MessageListParams {
  handleStatus?: number
  page?: number
  pageSize?: number
}

export const getDingtalkMessages = (params: MessageListParams) =>
  request.get<PageResponse<DingtalkMessage>>('/dingtalk/messages', { params })

export const generateDocFromMessage = (id: number) =>
  request.post(`/dingtalk/messages/${id}/generate`)

export const ignoreMessage = (id: number) =>
  request.post(`/dingtalk/messages/${id}/ignore`)

export const getAutoDetectConfig = () =>
  request.get<AutoDetectConfig>('/dingtalk/auto-detect/config')

export const updateAutoDetectConfig = (data: AutoDetectConfig) =>
  request.put('/dingtalk/auto-detect/config', data)

export const batchScanMessages = () =>
  request.post<{ scanned: number; matched: number; generated: number }>(
    '/dingtalk/auto-detect/scan',
  )
