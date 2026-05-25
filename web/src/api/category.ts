import request from '@/utils/request'
import type { Category } from '@/types'

export const getCategoryTree = () => request.get<Category[]>('/category/tree')

export const getCategoryList = () => request.get<Category[]>('/category/list')

export const createCategory = (data: Partial<Category>) =>
  request.post('/category', data)

export const updateCategory = (id: number, data: Partial<Category>) =>
  request.put(`/category/${id}`, data)

export const deleteCategory = (id: number) => request.delete(`/category/${id}`)
