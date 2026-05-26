<template>
  <div class="login-page">
    <!-- 动态背景光晕装饰 -->
    <div class="bg-orb orb-1"></div>
    <div class="bg-orb orb-2"></div>
    <div class="bg-orb orb-3"></div>
    <div class="bg-orb orb-4"></div>
    <!-- 网格装饰 -->
    <div class="bg-grid"></div>

    <div class="login-card">
      <div class="login-header">
        <div class="icon-wrapper">
          <el-icon :size="32"><Collection /></el-icon>
        </div>
        <h1>前端知识库</h1>
        <p>团队知识沉淀与智能检索平台</p>
      </div>
      <el-form ref="formRef" :model="form" :rules="rules" size="large" @submit.prevent="handleLogin">
        <el-form-item prop="username">
          <el-input
            v-model="form.username"
            placeholder="请输入用户名"
            prefix-icon="User"
            clearable
          />
        </el-form-item>
        <el-form-item prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="请输入密码"
            prefix-icon="Lock"
            show-password
            @keyup.enter="handleLogin"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" class="login-btn" @click="handleLogin">
            登 录
          </el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { Collection } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()
const formRef = ref<FormInstance>()
const loading = ref(false)

const form = reactive({
  username: '',
  password: ''
})

const rules: FormRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码长度不少于6位', trigger: 'blur' }
  ]
}

async function handleLogin() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  loading.value = true
  try {
    await userStore.login(form.username, form.password)
    ElMessage.success('登录成功')
    router.push('/home')
  } catch {
    // 错误已在 request 拦截器中处理
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
/* ===================== 背景与布局 ===================== */
.login-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: radial-gradient(ellipse at 20% 30%, #1a1040 0%, #0d0820 40%, #060412 100%);
  position: relative;
  overflow: hidden;
}

/* 背景网格 */
.bg-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.025) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.025) 1px, transparent 1px);
  background-size: 48px 48px;
  pointer-events: none;
}

/* ===================== 动态光晕 ===================== */
.bg-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  pointer-events: none;
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
  animation-direction: alternate;
}

.orb-1 {
  width: 480px;
  height: 480px;
  background: radial-gradient(circle, rgba(59, 130, 246, 0.22) 0%, transparent 65%);
  top: -180px;
  left: -120px;
  animation: orbFloat1 8s ease-in-out infinite alternate;
}

.orb-2 {
  width: 420px;
  height: 420px;
  background: radial-gradient(circle, rgba(124, 58, 237, 0.2) 0%, transparent 65%);
  bottom: -140px;
  right: -100px;
  animation: orbFloat2 10s ease-in-out infinite alternate;
}

.orb-3 {
  width: 300px;
  height: 300px;
  background: radial-gradient(circle, rgba(16, 185, 129, 0.12) 0%, transparent 65%);
  top: 40%;
  left: 60%;
  animation: orbFloat3 12s ease-in-out infinite alternate;
}

.orb-4 {
  width: 240px;
  height: 240px;
  background: radial-gradient(circle, rgba(245, 158, 11, 0.1) 0%, transparent 65%);
  top: 20%;
  right: 15%;
  animation: orbFloat4 9s ease-in-out infinite alternate;
}

@keyframes orbFloat1 {
  0% { transform: translate(0, 0) scale(1); }
  100% { transform: translate(40px, 30px) scale(1.08); }
}

@keyframes orbFloat2 {
  0% { transform: translate(0, 0) scale(1); }
  100% { transform: translate(-30px, -40px) scale(1.1); }
}

@keyframes orbFloat3 {
  0% { transform: translate(0, 0) scale(1); opacity: 0.7; }
  100% { transform: translate(-50px, 30px) scale(0.9); opacity: 1; }
}

@keyframes orbFloat4 {
  0% { transform: translate(0, 0) scale(1); }
  100% { transform: translate(20px, -30px) scale(1.05); }
}

/* ===================== 登录卡片 ===================== */
.login-card {
  width: 420px;
  padding: 48px 40px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 24px;
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.04),
    0 32px 80px rgba(0, 0, 0, 0.55),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(32px) saturate(150%);
  -webkit-backdrop-filter: blur(32px) saturate(150%);
  position: relative;
  z-index: 1;
  animation: cardIn 0.6s cubic-bezier(0.22, 1, 0.36, 1) both;

  /* 覆盖 Element Plus 输入框 CSS 变量 */
  --el-input-bg-color: rgba(255, 255, 255, 0.07);
  --el-input-border-color: rgba(255, 255, 255, 0.1);
  --el-input-hover-border-color: rgba(255, 255, 255, 0.2);
  --el-input-focus-border-color: rgba(96, 165, 250, 0.6);
  --el-input-text-color: #e2e8f0;
  --el-input-placeholder-color: rgba(100, 116, 139, 0.8);
  --el-input-icon-color: rgba(100, 116, 139, 0.9);
  --el-fill-color-blank: rgba(255, 255, 255, 0.07);
  --el-border-color: rgba(255, 255, 255, 0.1);
  --el-border-color-hover: rgba(255, 255, 255, 0.2);
  --el-color-primary: #60a5fa;
}

@keyframes cardIn {
  0% {
    opacity: 0;
    transform: translateY(28px) scale(0.97);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* ===================== 顶部图标区 ===================== */
.login-header {
  text-align: center;
  margin-bottom: 36px;
}

.icon-wrapper {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.25), rgba(124, 58, 237, 0.25));
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 18px;
  margin-bottom: 16px;
  animation: iconPulse 3s ease-in-out infinite;
}

.icon-wrapper :deep(.el-icon) {
  color: #60a5fa !important;
  filter: drop-shadow(0 0 8px rgba(96, 165, 250, 0.6));
}

@keyframes iconPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(96, 165, 250, 0); }
  50% { box-shadow: 0 0 0 8px rgba(96, 165, 250, 0.08); }
}

.login-header h1 {
  margin: 0 0 8px;
  font-size: 24px;
  font-weight: 700;
  background: linear-gradient(135deg, #bfdbfe, #ddd6fe);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  letter-spacing: 2px;
}

.login-header p {
  margin: 0;
  color: rgba(148, 163, 184, 0.7);
  font-size: 13px;
  letter-spacing: 0.5px;
}

/* ===================== 表单样式 ===================== */
:deep(.el-form-item) {
  margin-bottom: 20px;
}

:deep(.el-input__wrapper) {
  border-radius: 12px !important;
  height: 48px;
  transition: all 0.25s !important;
  background: rgba(255, 255, 255, 0.07) !important;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.1) inset !important;
}

:deep(.el-input__wrapper:hover) {
  background: rgba(255, 255, 255, 0.1) !important;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.18) inset !important;
}

:deep(.el-input__wrapper.is-focus) {
  background: rgba(59, 130, 246, 0.1) !important;
  box-shadow: 0 0 0 1.5px rgba(96, 165, 250, 0.6) inset, 0 0 20px rgba(96, 165, 250, 0.12) !important;
}

:deep(.el-input__inner) {
  color: #e2e8f0 !important;
  font-size: 15px !important;
  background: transparent !important;
}

:deep(.el-input__inner::placeholder) {
  color: rgba(100, 116, 139, 0.8) !important;
}

:deep(.el-input__prefix .el-icon),
:deep(.el-input__suffix .el-icon) {
  color: rgba(100, 116, 139, 0.9) !important;
}

:deep(.el-input__password) {
  color: rgba(100, 116, 139, 0.9) !important;
}

:deep(.el-form-item__error) {
  color: #f87171 !important;
  font-size: 12px !important;
}

/* ===================== 登录按钮 ===================== */
.login-btn {
  width: 100%;
  height: 48px;
  font-size: 15px;
  font-weight: 600;
  background: linear-gradient(135deg, #3b82f6 0%, #6d28d9 100%) !important;
  border: none !important;
  border-radius: 12px !important;
  box-shadow: 0 4px 20px rgba(59, 130, 246, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.15) !important;
  letter-spacing: 5px;
  color: #fff !important;
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
  position: relative;
  overflow: hidden;
}

.login-btn::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, transparent 30%, rgba(255, 255, 255, 0.12) 50%, transparent 70%);
  transform: translateX(-100%);
  transition: transform 0.5s;
}

.login-btn:hover::before {
  transform: translateX(100%);
}

.login-btn:hover {
  transform: translateY(-3px) !important;
  box-shadow: 0 8px 30px rgba(59, 130, 246, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.2) !important;
}

.login-btn:active {
  transform: translateY(-1px) !important;
}
</style>
