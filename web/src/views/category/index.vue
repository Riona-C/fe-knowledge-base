<template>
  <el-card shadow="never">
    <template #header>
      <div class="card-header">
        <span>分类管理</span>
        <el-button type="primary" @click="openDialog()">新增分类</el-button>
      </div>
    </template>

    <el-table
      :data="categoryStore.categoryTree"
      row-key="id"
      :tree-props="{ children: 'children' }"
      default-expand-all
      v-loading="loading"
      stripe
    >
      <el-table-column prop="categoryName" label="分类名称" min-width="200" />
      <el-table-column prop="sort" label="排序" width="100" />
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" link @click="openDialog(row)">编辑</el-button>
          <el-button type="primary" link @click="openDialog(undefined, row.id)">添加子分类</el-button>
          <el-button type="danger" link @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="480px"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="上级分类" prop="parentId">
          <el-tree-select
            v-model="form.parentId"
            :data="treeSelectData"
            :props="{ label: 'categoryName', value: 'id', children: 'children' }"
            check-strictly
            clearable
            placeholder="无（顶级分类）"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="分类名称" prop="categoryName">
          <el-input v-model="form.categoryName" placeholder="请输入分类名称" />
        </el-form-item>
        <el-form-item label="排序" prop="sort">
          <el-input-number v-model="form.sort" :min="0" :max="9999" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { useCategoryStore } from '@/stores/category'
import { createCategory, updateCategory, deleteCategory } from '@/api/category'
import type { Category } from '@/types'

const categoryStore = useCategoryStore()
const loading = ref(false)
const submitLoading = ref(false)
const dialogVisible = ref(false)
const editingId = ref<number | null>(null)
const formRef = ref<FormInstance>()

const form = reactive({
  parentId: 0,
  categoryName: '',
  sort: 0
})

const rules: FormRules = {
  categoryName: [{ required: true, message: '请输入分类名称', trigger: 'blur' }]
}

const dialogTitle = computed(() => (editingId.value ? '编辑分类' : '新增分类'))

const treeSelectData = computed(() => [
  { id: 0, categoryName: '无（顶级分类）', children: categoryStore.categoryTree }
])

function openDialog(row?: Category, parentId?: number) {
  editingId.value = row?.id ?? null
  form.parentId = parentId ?? row?.parentId ?? 0
  form.categoryName = row?.categoryName ?? ''
  form.sort = row?.sort ?? 0
  dialogVisible.value = true
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  submitLoading.value = true
  try {
    const payload = { ...form, parentId: form.parentId || 0 }
    if (editingId.value) {
      await updateCategory(editingId.value, payload)
      ElMessage.success('更新成功')
    } else {
      await createCategory(payload)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    await loadData()
  } catch {
    // 错误已处理
  } finally {
    submitLoading.value = false
  }
}

async function handleDelete(row: Category) {
  await ElMessageBox.confirm(`确定删除分类「${row.categoryName}」吗？`, '提示', {
    type: 'warning'
  })
  try {
    await deleteCategory(row.id)
    ElMessage.success('删除成功')
    await loadData()
  } catch {
    // 错误已处理
  }
}

async function loadData() {
  loading.value = true
  try {
    await categoryStore.fetchTree()
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
</style>
