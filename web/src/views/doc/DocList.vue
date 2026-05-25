<template>
  <el-card shadow="never">
    <el-form :model="query" inline class="search-form">
      <el-form-item label="关键词">
        <el-input v-model="query.keyword" placeholder="搜索标题/内容" clearable @keyup.enter="handleSearch" />
      </el-form-item>
      <el-form-item label="分类">
        <el-tree-select v-model="query.categoryId" :data="categoryStore.categoryTree"
          :props="{ label: 'categoryName', value: 'id', children: 'children' }" check-strictly clearable
          placeholder="全部分类" style="width: 180px" />
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="query.status" clearable placeholder="全部状态" style="width: 120px">
          <el-option label="待审核" :value="0" />
          <el-option label="已发布" :value="1" />
          <el-option label="已驳回" :value="2" />
        </el-select>
      </el-form-item>
      <el-form-item label="标签">
        <el-input v-model="query.tags" placeholder="标签筛选" clearable />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="handleSearch">搜索</el-button>
        <el-button @click="handleReset">重置</el-button>
        <el-button type="primary" @click="router.push('/doc/create')">新增文档</el-button>
      </el-form-item>
    </el-form>

    <el-table :data="tableData" v-loading="loading" stripe>
      <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip />
      <el-table-column prop="categoryName" label="分类" width="120" />
      <el-table-column prop="tags" label="标签" width="150" show-overflow-tooltip />
      <el-table-column prop="source" label="来源" width="100">
        <template #default="{ row }">{{ sourceText(row.source) }}</template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="statusTagType(row.status)" size="small">{{ statusText(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="createTime" label="创建时间" width="180" />
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" link @click="router.push(`/doc/detail/${row.id}`)">查看</el-button>
          <el-button type="primary" link @click="router.push(`/doc/edit/${row.id}`)">编辑</el-button>
          <el-button type="danger" link @click="handleDelete(row.id)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination v-model:current-page="query.page" v-model:page-size="query.pageSize" :total="total"
      :page-sizes="[10, 20, 50]" layout="total, sizes, prev, pager, next" class="pagination" @change="loadData" />
  </el-card>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getDocList, deleteDoc } from '@/api/doc'
import { useCategoryStore } from '@/stores/category'
import type { DocIssue } from '@/types'

const router = useRouter()
const categoryStore = useCategoryStore()
const loading = ref(false)
const tableData = ref<DocIssue[]>([])
const total = ref(0)

const query = reactive({
  keyword: '',
  categoryId: undefined as number | undefined,
  status: undefined as number | undefined,
  tags: '',
  page: 1,
  pageSize: 10
})

function statusText(status: number) {
  const map: Record<number, string> = { 0: '待审核', 1: '已发布', 2: '已驳回' }
  return map[status] ?? '未知'
}

function statusTagType(status: number) {
  const map: Record<number, string> = { 0: 'warning', 1: 'success', 2: 'danger' }
  return map[status] ?? 'info'
}

function sourceText(source: number) {
  const map: Record<number, string> = { 1: '手动录入', 2: '钉钉采集' }
  return map[source] ?? '其他'
}

async function loadData() {
  loading.value = true
  try {
    const res = await getDocList({ ...query })
    tableData.value = res.list
    total.value = res.total
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  query.page = 1
  loadData()
}

function handleReset() {
  query.keyword = ''
  query.categoryId = undefined
  query.status = undefined
  query.tags = ''
  query.page = 1
  loadData()
}

async function handleDelete(id: number) {
  await ElMessageBox.confirm('确定删除该文档吗？', '提示', { type: 'warning' })
  try {
    await deleteDoc(id)
    ElMessage.success('删除成功')
    loadData()
  } catch {
    // 错误已处理
  }
}

onMounted(async () => {
  await categoryStore.fetchTree()
  loadData()
})
</script>

<style scoped>
.search-form {
  margin-bottom: 16px;
}

.pagination {
  margin-top: 16px;
  justify-content: flex-end;
}
</style>
