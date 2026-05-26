import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig
} from 'axios'
import { ElMessage } from 'element-plus'
import router from '@/router'
import {
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
  clearTokens
} from '@/utils/auth'
import type { ApiResponse } from '@/types'

// 自定义请求实例类型：拦截器已解包 data
interface RequestInstance extends AxiosInstance {
  get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T>
  post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T>
  put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T>
  delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T>
}

const axiosInstance = axios.create({
  baseURL: '/api',
  timeout: 30000
})

// 是否正在刷新 token
let isRefreshing = false
// 等待刷新完成的请求队列
let pendingQueue: Array<(token: string) => void> = []

function processQueue(token: string) {
  pendingQueue.forEach((cb) => cb(token))
  pendingQueue = []
}

// 请求拦截器：自动添加 Authorization
axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAccessToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// 响应拦截器
axiosInstance.interceptors.response.use(
  (response) => {
    const res = response.data as ApiResponse
    if (res.code !== 0) {
      ElMessage.error(res.message || '请求失败')
      return Promise.reject(new Error(res.message || '请求失败'))
    }
    return res.data
  },
  async (error) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean }

    if (error.response?.status === 401 && !originalRequest._retry) {
      const refresh = getRefreshToken()
      if (!refresh) {
        clearTokens()
        // 在登录页说明是用户名/密码错误，不跳转，让下方统一 toast 处理
        if (router.currentRoute.value.path !== '/login') {
          ElMessage.error('登录已过期，请重新登录')
          router.push('/login')
          return Promise.reject(error)
        }
      } else {
        if (isRefreshing) {
          return new Promise((resolve) => {
            pendingQueue.push((token: string) => {
              if (originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${token}`
              }
              resolve(axiosInstance(originalRequest))
            })
          })
        }

        originalRequest._retry = true
        isRefreshing = true

        try {
          const res = await axios.post<ApiResponse<{ accessToken: string; refreshToken: string }>>(
            '/api/auth/refresh',
            { refreshToken: refresh }
          )
          if (res.data.code !== 0) {
            throw new Error(res.data.message)
          }
          const { accessToken, refreshToken: newRefresh } = res.data.data
          setAccessToken(accessToken)
          setRefreshToken(newRefresh)
          processQueue(accessToken)
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${accessToken}`
          }
          return axiosInstance(originalRequest)
        } catch {
          clearTokens()
          ElMessage.error('登录已过期，请重新登录')
          router.push('/login')
          return Promise.reject(error)
        } finally {
          isRefreshing = false
        }
      }
    }

    const message = error.response?.data?.message || error.message || '网络错误'
    ElMessage.error(message)
    return Promise.reject(error)
  }
)

const request = axiosInstance as RequestInstance

export default request
