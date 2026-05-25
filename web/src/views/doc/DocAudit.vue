<template>
  <el-card shadow="never">
    <template #header>
      <div class="card-header">
        <span>文档审核</span>
        <el-button
          type="primary"
          :disabled="!selectedIds.length"
          @click="openAuditDialog(selectedIds, 1)"
        >
          批量通过
        </el-button>
      </div>
    </template>

    <el-table
      :data="tableData"
      v-loading="loading"
      stripe
      @selection-change="handleSelectionChange"
    >
      <el-table-column type="selection" width="50" />
      <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip />
      <el-table-column prop="categoryName" label="分类" width="120" />
      <el-table-column prop="tags" label="标签" width="150" show-overflow-tooltip />
      <el-table-column prop="source" label="来源" width="100">
        <template #default="{ row }">
          <el-tag :type="row.source === 2 ? 'warning' : ''" size="small">
            {{ row.source === 2 ? '钉钉采集' : '手动录入' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="createUserName" label="提交人" width="120" />
      <el-table-column prop="createTime" label="提交时间" width="180" />
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" link @click="router.push(`/doc/detail/${row.id}`)">查看</el-button>
          <el-button type="success" link @click="openAuditDialog([row.id], 1)">通过</el-button>
          <el-button type="danger" link @click="openAuditDialog([row.id], 2)">驳回</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      v-model:current-page="page"
      v-model:page-size="pageSize"
      :total="total"
      layout="total, prev, pager, next"
      class="pagination"
      @change="loadData"
    />

    <el-dialog v-model="auditDialogVisible" :title="auditStatus === 1 ? '审核通过' : '审核驳回'" width="480px">
      <el-form :model="auditForm" label-width="80px">
        <el-form-item label="备注">
          <el-input
            v-model="auditForm.auditRemark"
            type="textarea"
            :rows="3"
            :placeholder="auditStatus === 2 ? '请填写驳回原因' : '可选填写备注'"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="auditDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleAudit">确定</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getDocList, auditDoc, batchAuditDoc } from '@/api/doc'
import type { DocIssue } from '@/types'

const router = useRouter()
const loading = ref(false)
const submitLoading = ref(false)
const tableData = ref<DocIssue[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const selectedIds = ref<number[]>([])
const auditDialogVisible = ref(false)
const auditIds = ref<number[]>([])
const auditStatus = ref(2)

const auditForm = reactive({ auditRemark: '' })

function handleSelectionChange(rows: DocIssue[]) {
  selectedIds.value = rows.map((r) => r.id)
}

function openAuditDialog(ids: number[], status: number) {
  auditIds.value = ids
  auditStatus.value = status
  auditForm.auditRemark = ''
  auditDialogVisible.value = true
}

async function handleAudit() {
  if (auditStatus.value === 2 && !auditForm.auditRemark.trim()) {
    ElMessage.warning('请填写驳回原因')
    return
  }

  submitLoading.value = true
  try {
    if (auditIds.value.length === 1) {
      await auditDoc(auditIds.value[0], {
        status: auditStatus.value,
        auditRemark: auditForm.auditRemark
      })
    } else {
      await batchAuditDoc({
        ids: auditIds.value,
        status: auditStatus.value,
        auditRemark: auditForm.auditRemark
      })
    }
    ElMessage.success('审核完成')
    auditDialogVisible.value = false
    loadData()
  } catch {
    // 错误已处理
  } finally {
    submitLoading.value = false
  }
}

async function loadData() {
  loading.value = true
  try {
    const res = await getDocList({ status: 0, page: page.value, pageSize: pageSize.value })
    tableData.value = res.list
    total.value = res.total
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.pagination {
  margin-top: 16px;
  justify-content: flex-end;
}
</style>
