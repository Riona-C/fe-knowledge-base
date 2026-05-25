import request from '@/utils/request'
import type { DocIssue, PageResponse } from '@/types'

export interface DocListParams {
  keyword?: string
  categoryId?: number
  status?: number
  tags?: string
  page?: number
  pageSize?: number
}

export const getDocList = (params: DocListParams) =>
  request.get<PageResponse<DocIssue>>('/doc/list', { params })

export const getDocDetail = (id: number) => request.get<DocIssue>(`/doc/${id}`)

export const createDoc = (data: Partial<DocIssue>) => request.post('/doc', data)

export const updateDoc = (id: number, data: Partial<DocIssue>) =>
  request.put(`/doc/${id}`, data)

export const deleteDoc = (id: number) => request.delete(`/doc/${id}`)

export const auditDoc = (id: number, data: { status: number; auditRemark?: string }) =>
  request.put(`/doc/${id}/audit`, data)

export const batchDeleteDoc = (ids: number[]) =>
  request.delete('/doc/batch', { data: { ids } })

export const batchAuditDoc = (data: { ids: number[]; status: number; auditRemark?: string }) =>
  request.put('/doc/batch/audit', data)

export const getDocStats = () =>
  request.get<{
    total: number
    pendingAudit: number
    monthlyNew: number
    categoryCount: number
  }>('/doc/stats')
