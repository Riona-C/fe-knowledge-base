import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { getAccessToken } from '@/utils/auth'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/index.vue'),
    meta: { public: true }
  },
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    redirect: '/home',
    children: [
      {
        path: 'home',
        name: 'Home',
        component: () => import('@/views/home/index.vue'),
        meta: { title: '首页' }
      },
      {
        path: 'doc/list',
        name: 'DocList',
        component: () => import('@/views/doc/DocList.vue'),
        meta: { title: '文档列表' }
      },
      {
        path: 'doc/create',
        name: 'DocCreate',
        component: () => import('@/views/doc/DocEdit.vue'),
        meta: { title: '新增文档' }
      },
      {
        path: 'doc/edit/:id',
        name: 'DocEdit',
        component: () => import('@/views/doc/DocEdit.vue'),
        meta: { title: '编辑文档' }
      },
      {
        path: 'doc/detail/:id',
        name: 'DocDetail',
        component: () => import('@/views/doc/DocDetail.vue'),
        meta: { title: '文档详情' }
      },
      {
        path: 'doc/audit',
        name: 'DocAudit',
        component: () => import('@/views/doc/DocAudit.vue'),
        meta: { title: '文档审核', roles: ['admin'] }
      },
      {
        path: 'category',
        name: 'Category',
        component: () => import('@/views/category/index.vue'),
        meta: { title: '分类管理' }
      },
      {
        path: 'rag',
        name: 'RagSearch',
        component: () => import('@/views/rag/index.vue'),
        meta: { title: '智能检索' }
      },
      {
        path: 'dingtalk/config',
        name: 'DingtalkConfig',
        component: () => import('@/views/dingtalk/DingtalkConfig.vue'),
        meta: { title: '钉钉配置', roles: ['admin'] }
      },
      {
        path: 'dingtalk/messages',
        name: 'DingtalkMessages',
        component: () => import('@/views/dingtalk/DingtalkMessages.vue'),
        meta: { title: '消息采集', roles: ['admin'] }
      },
      {
        path: 'system/user',
        name: 'UserManage',
        component: () => import('@/views/system/UserManage.vue'),
        meta: { title: '用户管理', roles: ['admin'] }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach(async (to, _from, next) => {
  const token = getAccessToken()
  const isPublic = to.meta.public === true

  if (!token && !isPublic) {
    next('/login')
    return
  }

  if (token && to.path === '/login') {
    next('/home')
    return
  }

  const roles = to.meta.roles as string[] | undefined
  if (roles && roles.length > 0) {
    const userStore = useUserStore()
    if (!userStore.userInfo) {
      try {
        await userStore.fetchUserInfo()
      } catch {
        next('/login')
        return
      }
    }
    const userRole = userStore.userInfo?.role
    if (!userRole || !roles.includes(userRole)) {
      next('/home')
      return
    }
  }

  next()
})

export default router
