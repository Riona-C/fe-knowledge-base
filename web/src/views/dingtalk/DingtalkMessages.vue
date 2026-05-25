<template>
  <el-card shadow="never">
    <el-form inline class="search-form">
      <el-form-item label="处理状态">
        <el-select v-model="query.handleStatus" clearable placeholder="全部" style="width: 140px">
          <el-option label="待处理" :value="0" />
          <el-option label="已生成文档" :value="1" />
          <el-option label="已忽略" :value="2" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="handleSearch">搜索</el-button>
        <el-button type="warning" :loading="scanLoading" @click="handleBatchScan">
          批量智能扫描
        </el-button>
      </el-form-item>
    </el-form>

    <el-table :data="tableData" v-loading="loading" stripe>
      <el-table-column prop="sender" label="发送人" width="120" />
      <el-table-column prop="msgContent" label="消息内容" min-width="300" show-overflow-tooltip>
        <template #default="{ row }">
          {{ truncate(row.msgContent, 80) }}
        </template>
      </el-table-column>
      <el-table-column prop="sendTime" label="发送时间" width="180" />
      <el-table-column prop="handleStatus" label="处理状态" width="120">
        <template #default="{ row }">
          <el-tag :type="statusTagType(row.handleStatus)" size="small">
            {{ statusText(row.handleStatus) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="280" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" link @click="openDetail(row)">查看</el-button>
          <el-button v-if="row.handleStatus === 1 && row.docId" type="success" link
            @click="router.push(`/doc/detail/${row.docId}`)">
            查看文档
          </el-button>
          <el-button v-if="row.handleStatus === 0" type="success" link @click="handleGenerate(row.id)">
            生成文档
          </el-button>
          <el-button v-if="row.handleStatus === 0" type="info" link @click="handleIgnore(row.id)">
            忽略
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination v-model:current-page="query.page" v-model:page-size="query.pageSize" :total="total"
      layout="total, prev, pager, next" class="pagination" @change="loadData" />

    <el-dialog v-model="detailVisible" title="消息详情" width="600px">
      <el-descriptions :column="1" border>
        <el-descriptions-item label="发送人">{{ currentMsg?.sender }}</el-descriptions-item>
        <el-descriptions-item label="发送时间">{{ currentMsg?.sendTime }}</el-descriptions-item>
        <el-descriptions-item label="会话ID">{{ currentMsg?.conversationId }}</el-descriptions-item>
        <el-descriptions-item label="消息内容">
          <div class="msg-content">{{ currentMsg?.msgContent }}</div>
        </el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </el-card>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getDingtalkMessages, generateDocFromMessage, ignoreMessage, batchScanMessages } from '@/api/dingtalk'
import type { DingtalkMessage } from '@/types'

const router = useRouter()
const loading = ref(false)
const scanLoading = ref(false)
const tableData = ref<DingtalkMessage[]>([])
const total = ref(0)
const detailVisible = ref(false)
const currentMsg = ref<DingtalkMessage | null>(null)

const query = reactive({
  handleStatus: undefined as number | undefined,
  page: 1,
  pageSize: 10
})

function truncate(text: string, len: number) {
  if (!text) return ''
  return text.length > len ? text.slice(0, len) + '...' : text
}

function statusText(status: number) {
  const map: Record<number, string> = { 0: '待处理', 1: '已生成文档', 2: '已忽略' }
  return map[status] ?? '未知'
}

function statusTagType(status: number): 'warning' | 'success' | 'info' {
  const map: Record<number, 'warning' | 'success' | 'info'> = { 0: 'warning', 1: 'success', 2: 'info' }
  return map[status] ?? 'info'
}

function openDetail(row: DingtalkMessage) {
  currentMsg.value = row
  detailVisible.value = true
}

function handleSearch() {
  query.page = 1
  loadData()
}

async function handleGenerate(id: number) {
  await ElMessageBox.confirm('确定根据该消息生成文档吗？', '提示')
  try {
    const docId = await generateDocFromMessage(id) as unknown as number
    ElMessage.success('文档生成成功')
    if (docId) router.push(`/doc/edit/${docId}`)
    loadData()
  } catch {
    // 错误已处理
  }
}

async function handleIgnore(id: number) {
  await ElMessageBox.confirm('确定忽略该消息吗？', '提示')
  try {
    await ignoreMessage(id)
    ElMessage.success('已忽略')
    loadData()
  } catch {
    // 错误已处理
  }
}

async function handleBatchScan() {
  await ElMessageBox.confirm(
    '将对所有未处理消息进行关键词扫描并自动生成文档（AI调用可能需要一定时间），确认执行？',
    '批量智能扫描',
    { type: 'warning' },
  )
  scanLoading.value = true
  try {
    const result = await batchScanMessages()
    ElMessage.success(
      `扫描完成：共 ${result.scanned} 条消息，命中 ${result.matched} 条，生成 ${result.generated} 篇文档`,
    )
    loadData()
  } catch {
    // 错误已处理
  } finally {
    scanLoading.value = false
  }
}

async function loadData() {
  loading.value = true
  try {
    const res = await getDingtalkMessages({ ...query })
    tableData.value = res.list
    total.value = res.total
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
</script>

<style scoped>
.search-form {
  margin-bottom: 16px;
}

.pagination {
  margin-top: 16px;
  justify-content: flex-end;
}

.msg-content {
  white-space: pre-wrap;
  line-height: 1.6;
}
</style>
