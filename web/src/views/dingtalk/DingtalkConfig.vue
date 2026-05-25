<template>
  <div class="config-page">
    <el-card shadow="never" v-loading="loading">
      <template #header>
        <span>钉钉配置</span>
      </template>

      <el-form ref="formRef" :model="form" :rules="rules" label-width="120px" style="max-width: 600px">
        <el-form-item label="AppKey" prop="appKey">
          <el-input v-model="form.appKey" placeholder="请输入 AppKey" />
        </el-form-item>
        <el-form-item label="AppSecret" prop="appSecret">
          <el-input v-model="form.appSecret" type="password" show-password placeholder="请输入 AppSecret" />
        </el-form-item>
        <el-form-item label="RobotCode" prop="robotCode">
          <el-input v-model="form.robotCode" placeholder="请输入机器人编码" />
        </el-form-item>
        <el-form-item label="群组ID" prop="groupIds">
          <el-input
            v-model="form.groupIds"
            type="textarea"
            :rows="3"
            placeholder="多个群组ID用逗号分隔"
          />
        </el-form-item>
        <el-form-item label="启用采集">
          <el-switch v-model="form.enable" :active-value="1" :inactive-value="0" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="submitLoading" @click="handleSave">保存配置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" v-loading="detectLoading" class="detect-card">
      <template #header>
        <div class="detect-header">
          <span>智能检测配置</span>
          <el-tag type="success" size="small" v-if="detectForm.enabled">已开启</el-tag>
          <el-tag type="info" size="small" v-else>已关闭</el-tag>
        </div>
      </template>

      <el-alert
        type="info"
        :closable="false"
        show-icon
        class="detect-alert"
      >
        <template #title>
          开启后，系统会自动监控群消息中的关键词（如 bug、花屏、兼容问题等），
          自动读取上下文聊天记录，通过 AI 提取问题和解决方案并分类入库（待审核状态）。
        </template>
      </el-alert>

      <el-form label-width="120px" style="max-width: 600px; margin-top: 16px">
        <el-form-item label="自动检测">
          <el-switch v-model="detectForm.enabled" />
        </el-form-item>
        <el-form-item label="检测关键词">
          <div class="keywords-area">
            <div class="keywords-tags">
              <el-tag
                v-for="(kw, idx) in keywordList"
                :key="idx"
                closable
                :disable-transitions="false"
                @close="removeKeyword(idx)"
              >
                {{ kw }}
              </el-tag>
              <el-input
                v-if="inputVisible"
                ref="inputRef"
                v-model="inputValue"
                class="keyword-input"
                size="small"
                @keyup.enter="confirmInput"
                @blur="confirmInput"
              />
              <el-button v-else size="small" @click="showInput">+ 添加关键词</el-button>
            </div>
            <div class="keywords-hint">
              消息中包含以上任意关键词时，将自动触发 AI 提取
            </div>
          </div>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="detectSubmitLoading" @click="handleSaveDetect">
            保存检测配置
          </el-button>
          <el-button @click="resetKeywords">恢复默认关键词</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, nextTick } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import {
  getDingtalkConfig,
  updateDingtalkConfig,
  getAutoDetectConfig,
  updateAutoDetectConfig,
} from '@/api/dingtalk'

const DEFAULT_KEYWORDS = [
  'bug', 'BUG', 'Bug',
  '问题', '报错', '异常', '错误',
  '解决方案', '解决了', '解决办法', '怎么解决',
  '兼容问题', '兼容性', '不兼容',
  '低端机', '低端设备', '低端手机',
  '花屏', '闪屏', '白屏', '黑屏', '卡顿', '崩溃', '闪退',
  '内存泄漏', '内存溢出', 'OOM',
  '踩坑', '踩了个坑', '坑点',
  '样式错乱', '布局错乱', '页面错乱',
  'crash', 'Crash', 'CRASH',
  '回退', '降级', 'polyfill', 'Polyfill',
  '适配', '屏幕适配', '机型适配',
]

// ========== 钉钉基础配置 ==========
const formRef = ref<FormInstance>()
const loading = ref(false)
const submitLoading = ref(false)

const form = reactive({
  id: 0,
  appKey: '',
  appSecret: '',
  robotCode: '',
  groupIds: '',
  enable: 0,
})

const rules: FormRules = {
  appKey: [{ required: true, message: '请输入 AppKey', trigger: 'blur' }],
  appSecret: [{ required: true, message: '请输入 AppSecret', trigger: 'blur' }],
  robotCode: [{ required: true, message: '请输入 RobotCode', trigger: 'blur' }],
}

// ========== 自动检测配置 ==========
const detectLoading = ref(false)
const detectSubmitLoading = ref(false)
const inputVisible = ref(false)
const inputValue = ref('')
const inputRef = ref<InstanceType<typeof import('element-plus')['ElInput']>>()

const detectForm = reactive({
  enabled: false,
  keywords: '',
})

const keywordList = computed({
  get: () =>
    detectForm.keywords
      ? detectForm.keywords.split(',').filter(Boolean)
      : [],
  set: (val: string[]) => {
    detectForm.keywords = val.join(',')
  },
})

function removeKeyword(idx: number) {
  const list = [...keywordList.value]
  list.splice(idx, 1)
  keywordList.value = list
}

function showInput() {
  inputVisible.value = true
  nextTick(() => inputRef.value?.focus())
}

function confirmInput() {
  const val = inputValue.value.trim()
  if (val && !keywordList.value.includes(val)) {
    keywordList.value = [...keywordList.value, val]
  }
  inputVisible.value = false
  inputValue.value = ''
}

function resetKeywords() {
  detectForm.keywords = DEFAULT_KEYWORDS.join(',')
  ElMessage.info('已恢复默认关键词，点击保存生效')
}

// ========== 数据加载 ==========
async function loadConfig() {
  loading.value = true
  try {
    const data = await getDingtalkConfig()
    Object.assign(form, data)
  } catch {
    // 首次可能无配置
  } finally {
    loading.value = false
  }
}

async function loadDetectConfig() {
  detectLoading.value = true
  try {
    const data = await getAutoDetectConfig()
    detectForm.enabled = data.enabled
    detectForm.keywords = data.keywords
  } catch {
    detectForm.keywords = DEFAULT_KEYWORDS.join(',')
  } finally {
    detectLoading.value = false
  }
}

async function handleSave() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  submitLoading.value = true
  try {
    await updateDingtalkConfig(form)
    ElMessage.success('保存成功')
  } catch {
    // 错误已处理
  } finally {
    submitLoading.value = false
  }
}

async function handleSaveDetect() {
  detectSubmitLoading.value = true
  try {
    await updateAutoDetectConfig({
      enabled: detectForm.enabled,
      keywords: detectForm.keywords,
    })
    ElMessage.success('检测配置已保存')
  } catch {
    // 错误已处理
  } finally {
    detectSubmitLoading.value = false
  }
}

onMounted(() => {
  loadConfig()
  loadDetectConfig()
})
</script>

<style scoped>
.config-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.detect-card {
  margin-top: 0;
}

.detect-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.detect-alert {
  margin-bottom: 8px;
}

.keywords-area {
  width: 100%;
}

.keywords-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.keyword-input {
  width: 120px;
}

.keywords-hint {
  margin-top: 8px;
  color: #909399;
  font-size: 12px;
}
</style>
