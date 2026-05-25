import request from '@/utils/request'
import type { RagResult } from '@/types'

interface RagApiResult {
  vectorId: string
  distance: number
  chunkContent: string
  doc: {
    id: number
    title: string
    problem: string
    solution: string
    tags: string
    categoryId: number
  } | null
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
      categoryName: ''
    }))
}
