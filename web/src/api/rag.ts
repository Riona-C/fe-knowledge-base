import request from '@/utils/request'
import type { RagResult } from '@/types'

interface RagApiDoc {
  id: number
  title: string
  problem: string
  solution: string
  tags: string
  categoryId: number
  categoryName?: string
}

interface RagApiResult {
  vectorId: string
  distance: number
  chunkContent: string
  doc: RagApiDoc | null
}

interface RagApiResponse {
  query: string
  results: RagApiResult[]
}

export const ragSearch = async (data: { query: string; topK?: number }): Promise<RagResult[]> => {
  const res = await request.post<RagApiResponse>('/rag/search', data)
  return (res.results || [])
    .filter((r) => r.doc)
    .map((r) => ({
      docId: r.doc!.id,
      title: r.doc!.title,
      problem: r.doc!.problem || '',
      solution: r.doc!.solution || '',
      tags: r.doc!.tags || '',
      score: 1 - (r.distance || 0),
      categoryName: r.doc!.categoryName || ''
    }))
}

export const ragChat = (data: { query: string; topK?: number }) =>
  request.post<{ query: string; answer: string; references: { docId: number; title: string }[] }>(
    '/rag/chat',
    data,
    { timeout: 120000 }
  )
