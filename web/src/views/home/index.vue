<template>
  <div class="home-page">
    <el-row :gutter="20" class="stat-row">
      <el-col :span="6" v-for="(item, index) in statCards" :key="item.key" :class="`stat-col-${index}`">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <el-icon :size="36" :color="item.color"><component :is="item.icon" /></el-icon>
            <div class="stat-info">
              <div class="stat-value">{{ stats[item.key] ?? '-' }}</div>
              <div class="stat-label">{{ item.label }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card class="recent-card" shadow="never">
      <template #header>
        <div class="card-header">
          <span>最近文档</span>
          <el-button type="primary" link @click="router.push('/doc/list')">查看全部</el-button>
        </div>
      </template>
      <el-table :data="recentDocs" stripe v-loading="loading">
        <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip />
        <el-table-column prop="categoryName" label="分类" width="120" />
        <el-table-column prop="tags" label="标签" width="150" show-overflow-tooltip />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">{{ statusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="创建时间" width="180" />
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="router.push(`/doc/detail/${row.id}`)">查看</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Document, Clock, Plus, Folder } from '@element-plus/icons-vue'
import { getDocStats, getDocList } from '@/api/doc'
import type { DocIssue } from '@/types'

const router = useRouter()
const loading = ref(false)

const stats = reactive({
  total: 0,
  pendingAudit: 0,
  monthlyNew: 0,
  categoryCount: 0
})

const recentDocs = ref<DocIssue[]>([])

const statCards = [
  { key: 'total' as const, label: '文档总数', icon: Document, color: '#409eff' },
  { key: 'pendingAudit' as const, label: '待审核', icon: Clock, color: '#e6a23c' },
  { key: 'monthlyNew' as const, label: '本月新增', icon: Plus, color: '#67c23a' },
  { key: 'categoryCount' as const, label: '分类数', icon: Folder, color: '#909399' }
]

function statusText(status: number) {
  const map: Record<number, string> = { 0: '待审核', 1: '已发布', 2: '已驳回' }
  return map[status] ?? '未知'
}

function statusTagType(status: number) {
  const map: Record<number, string> = { 0: 'warning', 1: 'success', 2: 'danger' }
  return map[status] ?? 'info'
}

onMounted(async () => {
  loading.value = true
  try {
    const [statsData, listData] = await Promise.all([
      getDocStats(),
      getDocList({ page: 1, pageSize: 10 })
    ])
    Object.assign(stats, statsData)
    recentDocs.value = listData.list
  } catch {
    // 错误已处理
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.home-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* 各统计卡片渐变色 */
.stat-col-0 .stat-card,
.stat-col-1 .stat-card,
.stat-col-2 .stat-card,
.stat-col-3 .stat-card {
  border: none !important;
  border-radius: 16px !important;
  transition: transform 0.25s ease, box-shadow 0.25s ease !important;
}

.stat-col-0 .stat-card:hover,
.stat-col-1 .stat-card:hover,
.stat-col-2 .stat-card:hover,
.stat-col-3 .stat-card:hover {
  transform: translateY(-4px);
}

.stat-col-0 .stat-card {
  background: linear-gradient(135deg, #1d4ed8 0%, #60a5fa 100%) !important;
  box-shadow: 0 8px 24px rgba(59, 130, 246, 0.35) !important;
}

.stat-col-1 .stat-card {
  background: linear-gradient(135deg, #92400e 0%, #fbbf24 100%) !important;
  box-shadow: 0 8px 24px rgba(245, 158, 11, 0.35) !important;
}

.stat-col-2 .stat-card {
  background: linear-gradient(135deg, #065f46 0%, #34d399 100%) !important;
  box-shadow: 0 8px 24px rgba(52, 211, 153, 0.35) !important;
}

.stat-col-3 .stat-card {
  background: linear-gradient(135deg, #5b21b6 0%, #c084fc 100%) !important;
  box-shadow: 0 8px 24px rgba(139, 92, 246, 0.35) !important;
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 6px 0;
}

.stat-content :deep(.el-icon) {
  background: rgba(255, 255, 255, 0.22);
  border-radius: 14px;
  padding: 12px;
  width: 60px !important;
  height: 60px !important;
  color: #fff !important;
  flex-shrink: 0;
}

.stat-value {
  font-size: 36px;
  font-weight: 700;
  color: #fff;
  line-height: 1;
  letter-spacing: -1px;
}

.stat-label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.72);
  margin-top: 8px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  font-size: 15px;
  color: #1e293b;
}

.recent-card {
  border-radius: 16px !important;
}
</style>
