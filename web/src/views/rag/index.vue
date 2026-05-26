<template>
  <div class="rag-page">
    <div class="search-hero">
      <h1>智能检索</h1>
      <p>输入您的问题，AI 将从知识库中为您找到最相关的解决方案</p>
      <div class="search-box">
        <el-input
          v-model="query"
          placeholder="例如：Vue3 如何实现路由守卫？"
          size="large"
          clearable
          @keyup.enter="handleSearch"
        >
          <template #append>
            <el-button type="primary" :loading="loading" @click="handleSearch">
              <el-icon><Search /></el-icon>
              搜索
            </el-button>
          </template>
        </el-input>
      </div>
    </div>

    <div v-if="searched" class="results-section" v-loading="loading">
      <div v-if="!results.length && !loading" class="empty-result">
        <el-empty description="未找到相关内容，请尝试其他关键词" />
      </div>
      <div v-else class="result-list">
        <div
          v-for="(item, index) in results"
          :key="item.docId"
          class="result-item"
          @click="router.push(`/doc/detail/${item.docId}`)"
        >
          <div class="result-rank">{{ index + 1 }}</div>
          <div class="result-content">
            <h3 class="result-title">{{ item.title }}</h3>
            <p class="result-summary">
              <strong>问题：</strong>{{ truncate(item.problem, 120) }}
            </p>
            <p class="result-summary">
              <strong>方案：</strong>{{ truncate(item.solution, 120) }}
            </p>
            <div class="result-footer">
              <el-tag v-if="item.categoryName" size="small">{{ item.categoryName }}</el-tag>
              <el-tag
                v-for="tag in parseTags(item.tags)"
                :key="tag"
                size="small"
                type="info"
                style="margin-left: 6px"
              >
                {{ tag }}
              </el-tag>
              <span class="score">相似度：{{ (item.score * 100).toFixed(1) }}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import { ragSearch } from '@/api/rag'
import type { RagResult } from '@/types'

const router = useRouter()
const query = ref('')
const loading = ref(false)
const searched = ref(false)
const results = ref<RagResult[]>([])

function truncate(text: string, len: number) {
  if (!text) return ''
  const plain = text.replace(/[#*`>\-\[\]]/g, '')
  return plain.length > len ? plain.slice(0, len) + '...' : plain
}

function parseTags(tags: string) {
  return tags ? tags.split(',').filter(Boolean) : []
}

async function handleSearch() {
  if (!query.value.trim()) {
    ElMessage.warning('请输入搜索内容')
    return
  }

  loading.value = true
  searched.value = true
  try {
    results.value = await ragSearch({ query: query.value.trim(), topK: 10 })
  } catch {
    results.value = []
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.rag-page {
  max-width: 840px;
  margin: 0 auto;
}

.search-hero {
  text-align: center;
  padding: 48px 0 36px;
  position: relative;
}

.search-hero::before {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 640px;
  height: 280px;
  background: radial-gradient(ellipse, rgba(59, 130, 246, 0.07) 0%, transparent 70%);
  pointer-events: none;
}

.search-hero h1 {
  font-size: 36px;
  font-weight: 700;
  margin-bottom: 10px;
  letter-spacing: -0.5px;
  background: linear-gradient(135deg, #1d4ed8, #7c3aed);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.search-hero p {
  color: #64748b;
  margin-bottom: 32px;
  font-size: 15px;
}

.search-box {
  max-width: 640px;
  margin: 0 auto;
}

:deep(.search-box .el-input__wrapper) {
  border-radius: 28px !important;
  box-shadow: 0 0 0 1px #dde3ef inset, 0 4px 16px rgba(15, 23, 42, 0.06) !important;
  padding: 0 6px 0 20px !important;
  transition: all 0.25s !important;
}

:deep(.search-box .el-input__wrapper:hover),
:deep(.search-box .el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 2px #3b82f6 inset, 0 8px 24px rgba(59, 130, 246, 0.12) !important;
}

:deep(.search-box .el-input-group__append) {
  background: linear-gradient(135deg, #3b82f6, #7c3aed) !important;
  border: none !important;
  border-radius: 0 24px 24px 0 !important;
  padding: 0 20px !important;
  color: #fff !important;
  font-weight: 600;
}

:deep(.search-box .el-input-group__append .el-button) {
  border: none !important;
  background: transparent !important;
  color: #fff !important;
  font-weight: 600;
  font-size: 15px;
}

:deep(.search-box .el-input-group__append .el-icon) {
  color: #fff !important;
}

.results-section {
  margin-top: 28px;
}

.result-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.result-item {
  display: flex;
  gap: 18px;
  padding: 22px;
  background: #fff;
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.25s;
  border: 1px solid rgba(226, 232, 240, 0.8);
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
}

.result-item:hover {
  box-shadow: 0 8px 28px rgba(59, 130, 246, 0.12);
  border-color: rgba(59, 130, 246, 0.3);
  transform: translateY(-2px);
}

.result-rank {
  width: 34px;
  height: 34px;
  background: linear-gradient(135deg, #3b82f6, #7c3aed);
  color: #fff;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 15px;
  flex-shrink: 0;
  box-shadow: 0 4px 10px rgba(59, 130, 246, 0.3);
}

.result-content {
  flex: 1;
  min-width: 0;
}

.result-title {
  margin: 0 0 10px;
  font-size: 17px;
  font-weight: 600;
  color: #1d4ed8;
  transition: color 0.2s;
}

.result-item:hover .result-title {
  color: #1e40af;
}

.result-summary {
  margin: 4px 0;
  color: #475569;
  font-size: 14px;
  line-height: 1.65;
}

.result-summary strong {
  color: #334155;
  font-weight: 600;
}

.result-footer {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 12px;
}

.score {
  margin-left: auto;
  background: linear-gradient(135deg, #059669, #34d399);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.3px;
}
</style>
