<template>
  <div class="rag-page">
    <div class="search-hero">
      <h1>智能检索</h1>
      <p>输入您的问题，AI 将从知识库中为您找到最相关的解决方案</p>
      <el-radio-group v-model="mode" class="mode-tabs">
        <el-radio-button value="search">文档检索</el-radio-button>
        <el-radio-button value="chat">对话问答</el-radio-button>
      </el-radio-group>
      <div class="search-box">
        <el-input
          v-model="query"
          placeholder="例如：Vue3 如何实现路由守卫？"
          size="large"
          clearable
          @keyup.enter="mode === 'search' ? handleSearch() : handleChat()"
        >
          <template #append>
            <el-button type="primary" :loading="loading" @click="mode === 'search' ? handleSearch() : handleChat()">
              <el-icon><Search /></el-icon>
              {{ mode === 'search' ? '搜索' : '提问' }}
            </el-button>
          </template>
        </el-input>
      </div>
    </div>

    <div v-if="mode === 'chat' && (loading || chatAnswer)" class="chat-answer" v-loading="loading">
      <div v-if="!loading" class="chat-answer-body markdown-body" v-html="renderedChatAnswer" />
      <div v-if="!loading && chatRefs.length" class="chat-refs">
        <span>参考文档：</span>
        <el-tag
          v-for="ref in chatRefs"
          :key="ref.docId"
          class="ref-tag"
          @click="router.push(`/doc/detail/${ref.docId}`)"
        >
          {{ ref.title }}
        </el-tag>
      </div>
    </div>

    <div v-if="mode === 'search' && searched" class="results-section" v-loading="loading">
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
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { ragChat, ragSearch } from '@/api/rag'
import type { RagResult } from '@/types'

const router = useRouter()
const mode = ref<'search' | 'chat'>('search')
const query = ref('')
const loading = ref(false)
const searched = ref(false)
const results = ref<RagResult[]>([])
const chatAnswer = ref('')
const chatRefs = ref<{ docId: number; title: string }[]>([])

const renderedChatAnswer = computed(() => {
  const html = marked.parse(chatAnswer.value || '') as string
  return DOMPurify.sanitize(html)
})

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
  chatAnswer.value = ''
  try {
    results.value = await ragSearch({ query: query.value.trim(), topK: 10 })
  } catch {
    results.value = []
  } finally {
    loading.value = false
  }
}

async function handleChat() {
  if (!query.value.trim()) {
    ElMessage.warning('请输入问题')
    return
  }
  loading.value = true
  chatAnswer.value = ''
  chatRefs.value = []
  try {
    const res = await ragChat({ query: query.value.trim(), topK: 5 })
    chatAnswer.value = res.answer?.trim() || '未生成有效回答，请稍后重试。'
    chatRefs.value = (res.references || []).map((ref) => ({
      docId: Number(ref.docId),
      title: ref.title
    }))
  } catch (err: unknown) {
    chatAnswer.value = ''
    const msg = err instanceof Error ? err.message : '对话请求失败'
    if (!msg.includes('登录已过期')) {
      ElMessage.error(msg.includes('timeout') ? 'AI 回答超时，请稍后重试' : '对话请求失败，请检查网络或重新登录')
    }
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

.mode-tabs {
  margin-bottom: 20px;
}

.search-box {
  max-width: 640px;
  margin: 0 auto;
}

.chat-answer {
  margin-top: 28px;
  padding: 24px;
  background: #fff;
  border-radius: 14px;
  border: 1px solid #e2e8f0;
  min-height: 80px;
}

.chat-answer-body {
  line-height: 1.75;
}

.chat-answer-body :deep(p) {
  margin: 0 0 12px;
}

.chat-answer-body :deep(ol),
.chat-answer-body :deep(ul) {
  margin: 0 0 12px;
  padding-left: 1.4em;
}

.chat-answer-body :deep(pre) {
  background: #f8fafc;
  padding: 12px;
  border-radius: 8px;
  overflow-x: auto;
}

.chat-answer-body :deep(code) {
  background: #f1f5f9;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.9em;
}

.chat-refs {
  margin-top: 16px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.ref-tag {
  cursor: pointer;
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
