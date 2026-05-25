import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as categoryApi from '@/api/category'
import type { Category } from '@/types'

export const useCategoryStore = defineStore('category', () => {
  const categoryTree = ref<Category[]>([])
  const flatList = ref<Category[]>([])

  async function fetchTree() {
    categoryTree.value = await categoryApi.getCategoryTree()
  }

  async function fetchList() {
    flatList.value = await categoryApi.getCategoryList()
  }

  return {
    categoryTree,
    flatList,
    fetchTree,
    fetchList
  }
})
