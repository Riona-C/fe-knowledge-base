<template>
  <el-container class="main-layout">
    <el-aside :width="appStore.sidebarCollapsed ? '64px' : '220px'" class="sidebar">
      <div class="logo" @click="router.push('/home')">
        <el-icon :size="24"><Collection /></el-icon>
        <span v-show="!appStore.sidebarCollapsed" class="logo-text">前端知识库</span>
      </div>
      <el-menu
        :default-active="activeMenu"
        :collapse="appStore.sidebarCollapsed"
        router
        background-color="transparent"
        text-color="rgba(203,213,225,0.85)"
        active-text-color="#60a5fa"
      >
        <el-menu-item index="/home">
          <el-icon><HomeFilled /></el-icon>
          <span>首页</span>
        </el-menu-item>

        <el-sub-menu index="knowledge">
          <template #title>
            <el-icon><Document /></el-icon>
            <span>知识库</span>
          </template>
          <el-menu-item index="/doc/list">文档列表</el-menu-item>
          <el-menu-item index="/doc/create">新增文档</el-menu-item>
          <el-menu-item index="/category">分类管理</el-menu-item>
        </el-sub-menu>

        <el-menu-item index="/rag">
          <el-icon><Search /></el-icon>
          <span>智能检索</span>
        </el-menu-item>

        <el-menu-item v-if="userStore.isAdmin" index="/doc/audit">
          <el-icon><Checked /></el-icon>
          <span>文档审核</span>
        </el-menu-item>

        <el-sub-menu v-if="userStore.isAdmin" index="dingtalk">
          <template #title>
            <el-icon><ChatDotRound /></el-icon>
            <span>钉钉采集</span>
          </template>
          <el-menu-item index="/dingtalk/config">配置管理</el-menu-item>
          <el-menu-item index="/dingtalk/messages">消息列表</el-menu-item>
        </el-sub-menu>

        <el-sub-menu v-if="userStore.isAdmin" index="system">
          <template #title>
            <el-icon><Setting /></el-icon>
            <span>系统管理</span>
          </template>
          <el-menu-item index="/system/user">用户管理</el-menu-item>
        </el-sub-menu>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header class="header">
        <div class="header-left">
          <el-icon class="collapse-btn" @click="appStore.toggleSidebar">
            <Fold v-if="!appStore.sidebarCollapsed" />
            <Expand v-else />
          </el-icon>
          <el-breadcrumb separator="/">
            <el-breadcrumb-item>{{ currentTitle }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        <div class="header-right">
          <el-avatar :size="32" :src="userStore.userInfo?.avatar">
            {{ userStore.userInfo?.nickName?.charAt(0) || 'U' }}
          </el-avatar>
          <span class="username">{{ userStore.userInfo?.nickName || userStore.userInfo?.username }}</span>
          <el-button type="danger" link @click="handleLogout">退出</el-button>
        </div>
      </el-header>

      <el-main v-loading="appStore.loading" class="main-content">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  HomeFilled,
  Document,
  Search,
  Checked,
  ChatDotRound,
  Setting,
  Collection,
  Fold,
  Expand
} from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'
import { useAppStore } from '@/stores/app'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const appStore = useAppStore()

const activeMenu = computed(() => route.path)
const currentTitle = computed(() => (route.meta.title as string) || '首页')

onMounted(async () => {
  if (!userStore.userInfo) {
    try {
      await userStore.fetchUserInfo()
    } catch {
      // 路由守卫会处理
    }
  }
})

function handleLogout() {
  userStore.logout()
}
</script>

<style scoped>
.main-layout {
  height: 100vh;
}

.sidebar {
  background: linear-gradient(180deg, #0f172a 0%, #1e293b 100%);
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  box-shadow: 2px 0 20px rgba(0, 0, 0, 0.2);
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
}

.logo {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  height: 64px;
  color: #fff;
  cursor: pointer;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
  transition: background 0.2s;
}

.logo:hover {
  background: rgba(255, 255, 255, 0.05);
}

.logo :deep(.el-icon) {
  color: #60a5fa !important;
  filter: drop-shadow(0 0 6px rgba(96, 165, 250, 0.5));
}

.logo-text {
  font-size: 16px;
  font-weight: 700;
  white-space: nowrap;
  background: linear-gradient(135deg, #93c5fd, #c4b5fd);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  letter-spacing: 0.5px;
}

:deep(.el-menu) {
  background: transparent !important;
  border-right: none !important;
  padding: 8px 0;
}

:deep(.el-menu-item) {
  margin: 2px 10px;
  border-radius: 8px;
  transition: all 0.2s;
  height: 42px;
  line-height: 42px;
}

:deep(.el-menu-item:hover) {
  background: rgba(255, 255, 255, 0.08) !important;
  color: #e2e8f0 !important;
}

:deep(.el-menu-item.is-active) {
  background: linear-gradient(90deg, rgba(96, 165, 250, 0.22), rgba(96, 165, 250, 0.05)) !important;
  color: #60a5fa !important;
  font-weight: 600;
  position: relative;
}

:deep(.el-menu-item.is-active::after) {
  content: '';
  position: absolute;
  right: 0;
  top: 8px;
  bottom: 8px;
  width: 3px;
  background: linear-gradient(180deg, #60a5fa, #a78bfa);
  border-radius: 2px 0 0 2px;
}

:deep(.el-sub-menu__title) {
  margin: 2px 10px;
  border-radius: 8px;
  transition: all 0.2s;
}

:deep(.el-sub-menu__title:hover) {
  background: rgba(255, 255, 255, 0.08) !important;
  color: #e2e8f0 !important;
}

:deep(.el-sub-menu .el-menu) {
  background: rgba(0, 0, 0, 0.2) !important;
  border-radius: 8px;
  margin: 4px 10px;
  padding: 4px 0 !important;
}

:deep(.el-sub-menu .el-menu-item) {
  margin: 2px 8px;
  height: 38px;
  line-height: 38px;
  font-size: 13px;
  padding-left: 16px !important;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(255, 255, 255, 0.95);
  border-bottom: 1px solid rgba(226, 232, 240, 0.8);
  box-shadow: 0 1px 16px rgba(15, 23, 42, 0.06);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  padding: 0 24px;
  height: 60px !important;
  position: sticky;
  top: 0;
  z-index: 9;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.collapse-btn {
  font-size: 18px;
  cursor: pointer;
  color: #94a3b8;
  transition: all 0.2s;
  padding: 7px;
  border-radius: 8px;
}

.collapse-btn:hover {
  color: #3b82f6;
  background: rgba(59, 130, 246, 0.08);
}

:deep(.el-breadcrumb__item:last-child .el-breadcrumb__inner) {
  color: #1e293b;
  font-weight: 600;
  font-size: 15px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

:deep(.header-right .el-avatar) {
  background: linear-gradient(135deg, #3b82f6, #8b5cf6) !important;
  font-weight: 700;
  font-size: 14px;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.35);
}

.username {
  color: #374151;
  font-size: 14px;
  font-weight: 500;
}

.main-content {
  background: #f1f5f9;
  padding: 24px;
  overflow: auto;
}
</style>
