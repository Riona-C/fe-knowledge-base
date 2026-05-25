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
  max-width: 800px;
  margin: 0 auto;
}

.search-hero {
  text-align: center;
  padding: 40px 0 32px;
}

.search-hero h1 {
  font-size: 32px;
  color: #303133;
  margin-bottom: 8px;
}

.search-hero p {
  color: #909399;
  margin-bottom: 32px;
}

.search-box {
  max-width: 600px;
  margin: 0 auto;
}

.results-section {
  margin-top: 24px;
}

.result-item {
  display: flex;
  gap: 16px;
  padding: 20px;
  background: #fff;
  border-radius: 8px;
  margin-bottom: 12px;
  cursor: pointer;
  transition: box-shadow 0.2s;
  border: 1px solid #ebeef5;
}

.result-item:hover {
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.15);
  border-color: #409eff;
}

.result-rank {
  width: 32px;
  height: 32px;
  background: #409eff;
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  flex-shrink: 0;
}

.result-title {
  margin: 0 0 8px;
  font-size: 18px;
  color: #409eff;
}

.result-summary {
  margin: 4px 0;
  color: #606266;
  font-size: 14px;
  line-height: 1.6;
}

.result-footer {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}

.score {
  margin-left: auto;
  color: #67c23a;
  font-size: 13px;
  font-weight: 500;
}
</style>
