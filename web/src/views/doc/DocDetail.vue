<template>
  <el-card shadow="never" v-loading="loading" class="doc-detail">
    <template v-if="doc">
      <div class="doc-header">
        <h1>{{ doc.title }}</h1>
        <div class="doc-meta">
          <el-breadcrumb separator="/">
            <el-breadcrumb-item>{{ doc.categoryName || '未分类' }}</el-breadcrumb-item>
          </el-breadcrumb>
          <div class="meta-tags">
            <el-tag v-for="tag in tagList" :key="tag" size="small" style="margin-right: 6px">{{ tag }}</el-tag>
          </div>
          <div class="meta-info">
            <span>创建时间：{{ doc.createTime }}</span>
            <span>浏览次数：{{ doc.viewCount }}</span>
            <span>创建人：{{ doc.createUserName || '-' }}</span>
          </div>
        </div>
      </div>

      <el-divider />

      <section class="doc-section">
        <h2>问题描述</h2>
        <div class="markdown-body" v-html="renderedProblem" />
      </section>

      <el-divider />

      <section class="doc-section">
        <h2>解决方案</h2>
        <div class="markdown-body" v-html="renderedSolution" />
      </section>

      <div class="doc-actions">
        <el-button @click="router.back()">返回</el-button>
        <el-button type="primary" @click="router.push(`/doc/edit/${doc.id}`)">编辑</el-button>
      </div>
    </template>
  </el-card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { getDocDetail } from '@/api/doc'
import type { DocIssue } from '@/types'

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const doc = ref<DocIssue | null>(null)

const tagList = computed(() => (doc.value?.tags ? doc.value.tags.split(',').filter(Boolean) : []))

function renderMarkdown(content: string) {
  const html = marked.parse(content || '') as string
  return DOMPurify.sanitize(html)
}

const renderedProblem = computed(() => renderMarkdown(doc.value?.problem || ''))
const renderedSolution = computed(() => renderMarkdown(doc.value?.solution || ''))

onMounted(async () => {
  loading.value = true
  try {
    doc.value = await getDocDetail(Number(route.params.id))
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.doc-detail {
  max-width: 960px;
  margin: 0 auto;
}

.doc-header h1 {
  margin: 0 0 16px;
  font-size: 28px;
  color: #303133;
}

.doc-meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: #909399;
  font-size: 14px;
}

.meta-info {
  display: flex;
  gap: 24px;
}

.doc-section h2 {
  font-size: 18px;
  color: #409eff;
  margin-bottom: 16px;
  padding-left: 12px;
  border-left: 4px solid #409eff;
}

.markdown-body {
  line-height: 1.8;
  color: #303133;
}

.markdown-body :deep(pre) {
  background: #f5f7fa;
  padding: 16px;
  border-radius: 6px;
  overflow-x: auto;
}

.markdown-body :deep(code) {
  background: #f0f2f5;
  padding: 2px 6px;
  border-radius: 4px;
}

.doc-actions {
  margin-top: 24px;
  display: flex;
  gap: 12px;
}
</style>
