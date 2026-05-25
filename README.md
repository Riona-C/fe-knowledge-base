# 前端踩坑知识库 RAG 系统

文档管理 + RAG 智能检索 + 钉钉群消息自动采集，解决前端团队重复踩坑问题。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Vue 3 + Vite + Element Plus + md-editor-v3 |
| 后端 | NestJS + TypeORM + Passport JWT |
| 数据库 | MySQL 8.0 |
| 缓存 | Redis 7 |
| 向量库 | ChromaDB |
| AI | 通义千问（OpenAI 兼容接口） |
| 部署 | Docker Compose + Nginx |

## 快速启动

### 方式一：Docker Compose（推荐）

```bash
cp .env.example .env
# 编辑 .env 填入 AI API Key
docker compose up -d
```

访问 `http://localhost`，默认账号 `admin / admin123`。

### 方式二：本地开发

**前置条件**：Node.js >= 18, MySQL 8.0, Redis

```bash
# 1. 初始化数据库
mysql -u root -p < sql/init.sql

# 2. 启动后端
cd server
cp .env.example .env   # 编辑配置
npm install
npm run start:dev

# 3. 启动前端（新终端）
cd web
npm install
npm run dev
```

- 前端：`http://localhost:5173`
- 后端 API：`http://localhost:3000/api`
- Swagger 文档：`http://localhost:3000/api/docs`

## RAG 智能检索上线操作

> 首次部署或向量库为空时，必须按顺序完成以下步骤，智能检索才能正常工作。

### 第一步：配置 Embedding API Key

编辑 `server/.env`，填入通义千问 DashScope API Key：

```bash
RAG_EMBEDDING_MODEL=text-embedding-v3
RAG_EMBEDDING_API_KEY=sk-xxxxxxxxxxxx        # ← 必填，否则向量化失败
RAG_EMBEDDING_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
```

申请地址：[阿里云 DashScope 控制台](https://dashscope.aliyun.com) → API Key 管理

### 第二步：启动 ChromaDB 服务

```bash
# Docker Compose 整体启动（推荐）
docker compose up -d chroma

# 验证 ChromaDB 是否正常（返回 {"nanosecond heartbeat": ...} 即成功）
curl http://localhost:8000/api/v1/heartbeat
```

### 第三步：全量同步现有文档到向量库

服务启动后，调用一次全量同步接口，将所有已发布文档写入 ChromaDB：

```bash
# 先登录获取管理员 Token
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq -r '.data.accessToken')

# 执行全量同步
curl -X POST http://localhost:3000/api/rag/sync/all \
  -H "Authorization: Bearer $TOKEN"
# 返回示例：{"total":50,"success":48,"failed":2}
```

后续文档审核通过后会**自动**触发向量同步，无需再手动执行。

### 第四步：验证智能检索

```bash
curl -X POST http://localhost:3000/api/rag/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query":"页面白屏问题"}'
```

返回 `results` 数组非空即表示向量库已就绪，前端「智能检索」页面可正常使用。

---

## 项目结构

```
fe-knowledge-base/
├── server/                 # NestJS 后端
│   └── src/
│       ├── common/         # 守卫、过滤器、拦截器、DTO
│       ├── config/         # 配置、日志
│       ├── entities/       # TypeORM 实体
│       └── modules/
│           ├── auth/       # JWT 双 Token 认证
│           ├── user/       # 用户管理
│           ├── category/   # 分类管理
│           ├── doc/        # 文档 CRUD + 审核
│           ├── rag/        # 向量检索 + Reranking
│           ├── dingtalk/   # Stream API 消息采集
│           └── health/     # 健康检查
├── web/                    # Vue3 前端
│   └── src/
│       ├── api/            # 接口定义
│       ├── stores/         # Pinia 状态管理
│       ├── router/         # 路由 + 权限守卫
│       ├── views/          # 页面组件
│       ├── layouts/        # 布局
│       └── utils/          # 请求封装、Token 管理
├── sql/                    # 数据库初始化脚本
├── docker-compose.yml      # 一键部署
└── .env.example            # 环境变量模板
```

## 核心功能

1. **文档管理** - Markdown 编辑、分类、标签、模糊搜索
2. **RAG 智能检索** - 向量化入库 → 相似检索 → Rerank 精排
3. **钉钉采集** - Stream API 监听群消息 → AI 自动提取 → 待审核文档
4. **审核流程** - 管理员审核通过后自动向量化发布
5. **权限控制** - admin/member 角色、路由守卫、接口守卫