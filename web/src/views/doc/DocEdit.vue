<template>
  <el-card shadow="never" v-loading="loading">
    <template #header>
      <span>{{ isEdit ? '编辑文档' : '新增文档' }}</span>
    </template>

    <el-form ref="formRef" :model="form" :rules="rules" label-width="100px" class="doc-form">
      <el-form-item label="分类" prop="categoryId">
        <el-tree-select
          v-model="form.categoryId"
          :data="categoryStore.categoryTree"
          :props="{ label: 'categoryName', value: 'id', children: 'children' }"
          check-strictly
          placeholder="请选择分类"
          style="width: 300px"
        />
      </el-form-item>
      <el-form-item label="标题" prop="title">
        <el-input v-model="form.title" placeholder="请输入文档标题" maxlength="200" show-word-limit />
      </el-form-item>
      <el-form-item label="问题描述" prop="problem">
        <MdEditor v-model="form.problem" language="zh-CN" style="height: 300px" />
      </el-form-item>
      <el-form-item label="解决方案" prop="solution">
        <MdEditor v-model="form.solution" language="zh-CN" style="height: 300px" />
      </el-form-item>
      <el-form-item label="标签">
        <div class="tag-input">
          <el-tag
            v-for="tag in tagList"
            :key="tag"
            closable
            @close="removeTag(tag)"
            style="margin-right: 8px"
          >
            {{ tag }}
          </el-tag>
          <el-input
            v-if="tagInputVisible"
            ref="tagInputRef"
            v-model="tagInputValue"
            size="small"
            style="width: 100px"
            @keyup.enter="addTag"
            @blur="addTag"
          />
          <el-button v-else size="small" @click="showTagInput">+ 添加标签</el-button>
        </div>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="submitLoading" @click="handleSubmit">保存</el-button>
        <el-button @click="router.back()">取消</el-button>
      </el-form-item>
    </el-form>
  </el-card>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { MdEditor } from 'md-editor-v3'
import 'md-editor-v3/lib/style.css'
import { getDocDetail, createDoc, updateDoc } from '@/api/doc'
import { useCategoryStore } from '@/stores/category'

const route = useRoute()
const router = useRouter()
const categoryStore = useCategoryStore()
const formRef = ref<FormInstance>()
const tagInputRef = ref()
const loading = ref(false)
const submitLoading = ref(false)
const tagInputVisible = ref(false)
const tagInputValue = ref('')

const docId = computed(() => Number(route.params.id))
const isEdit = computed(() => !!route.params.id)

const form = reactive({
  categoryId: undefined as number | undefined,
  title: '',
  problem: '',
  solution: '',
  tags: ''
})

const tagList = computed({
  get: () => (form.tags ? form.tags.split(',').filter(Boolean) : []),
  set: (val: string[]) => { form.tags = val.join(',') }
})

const rules: FormRules = {
  categoryId: [{ required: true, message: '请选择分类', trigger: 'change' }],
  title: [{ required: true, message: '请输入标题', trigger: 'blur' }],
  problem: [{ required: true, message: '请输入问题描述', trigger: 'blur' }],
  solution: [{ required: true, message: '请输入解决方案', trigger: 'blur' }]
}

function showTagInput() {
  tagInputVisible.value = true
  nextTick(() => tagInputRef.value?.focus())
}

function addTag() {
  const val = tagInputValue.value.trim()
  if (val && !tagList.value.includes(val)) {
    tagList.value = [...tagList.value, val]
  }
  tagInputVisible.value = false
  tagInputValue.value = ''
}

function removeTag(tag: string) {
  tagList.value = tagList.value.filter((t) => t !== tag)
}

async function loadDetail() {
  if (!isEdit.value) return
  loading.value = true
  try {
    const data = await getDocDetail(docId.value)
    form.categoryId = data.categoryId
    form.title = data.title
    form.problem = data.problem
    form.solution = data.solution
    form.tags = data.tags
  } finally {
    loading.value = false
  }
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  submitLoading.value = true
  try {
    if (isEdit.value) {
      await updateDoc(docId.value, form)
      ElMessage.success('更新成功')
    } else {
      await createDoc(form)
      ElMessage.success('创建成功')
    }
    router.push('/doc/list')
  } catch {
    // 错误已处理
  } finally {
    submitLoading.value = false
  }
}

onMounted(async () => {
  await categoryStore.fetchTree()
  loadDetail()
})
</script>

<style scoped>
.doc-form {
  max-width: 900px;
}

.tag-input {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}
</style>
