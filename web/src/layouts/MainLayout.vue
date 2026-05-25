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
        background-color="#001529"
        text-color="rgba(255,255,255,0.75)"
        active-text-color="#409eff"
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
  background: #001529;
  transition: width 0.3s;
  overflow: hidden;
}

.logo {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 60px;
  color: #fff;
  cursor: pointer;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.logo-text {
  font-size: 16px;
  font-weight: 600;
  white-space: nowrap;
}

.el-menu {
  border-right: none;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  border-bottom: 1px solid #e8e8e8;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.collapse-btn {
  font-size: 20px;
  cursor: pointer;
  color: #606266;
}

.collapse-btn:hover {
  color: #409eff;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.username {
  color: #303133;
  font-size: 14px;
}

.main-content {
  background: #f0f2f5;
  padding: 20px;
}
</style>
