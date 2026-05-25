// API 统一响应
export interface ApiResponse<T = any> {
  code: number
  message: string
  data: T
}

export interface PageResponse<T = any> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

// 用户
export interface UserInfo {
  id: number
  username: string
  nickName: string
  avatar: string
  role: string
  status: number
}

// 分类
export interface Category {
  id: number
  parentId: number
  categoryName: string
  sort: number
  children?: Category[]
}

// 文档
export interface DocIssue {
  id: number
  categoryId: number
  title: string
  problem: string
  solution: string
  tags: string
  source: number
  status: number
  viewCount: number
  createUserId: number
  createTime: string
  updateTime: string
  auditUserId?: number
  auditTime?: string
  auditRemark?: string
  categoryName?: string
  createUserName?: string
}

// RAG 检索结果
export interface RagResult {
  docId: number
  title: string
  problem: string
  solution: string
  tags: string
  score: number
  categoryName?: string
}

// 钉钉消息
export interface DingtalkMessage {
  id: number
  conversationId: string
  msgContent: string
  sender: string
  sendTime: string
  handleStatus: number
  docId?: number
}

// 钉钉配置
export interface DingtalkConfig {
  id: number
  appKey: string
  appSecret: string
  robotCode: string
  groupIds: string
  enable: number
}

// 自动检测配置
export interface AutoDetectConfig {
  enabled: boolean
  keywords: string
}
