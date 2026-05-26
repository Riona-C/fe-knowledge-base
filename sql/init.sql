-- ============================================
-- 前端踩坑知识库 RAG 系统 - 数据库初始化脚本
-- 已融合架构改进：软删除、角色、审计字段、
-- 钉钉 Stream API 配置、向量映射一对多
-- ============================================

CREATE DATABASE IF NOT EXISTS `fe_knowledge` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `fe_knowledge`;

-- 1. 用户表
CREATE TABLE `sys_user` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '用户ID',
  `username` varchar(50) NOT NULL COMMENT '账号',
  `password` varchar(100) NOT NULL COMMENT '密码（bcrypt加密）',
  `nick_name` varchar(50) DEFAULT NULL COMMENT '昵称',
  `avatar` varchar(500) DEFAULT NULL COMMENT '头像URL',
  `role` varchar(20) NOT NULL DEFAULT 'member' COMMENT '角色 admin-管理员 member-普通成员',
  `status` tinyint NOT NULL DEFAULT 1 COMMENT '状态 0-禁用 1-正常',
  `deleted` tinyint NOT NULL DEFAULT 0 COMMENT '软删除 0-正常 1-已删除',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- 默认管理员（初始密码 admin123，部署后请立即修改）
INSERT INTO `sys_user` (`username`, `password`, `nick_name`, `role`)
VALUES ('admin', '$2b$10$jbebWmmsictFxaZ9uZnn8eZJPgCmCjzqXOpKw4vJ4B/C7ra6CSQ3e', '系统管理员', 'admin');

-- 2. 文档分类表
CREATE TABLE `doc_category` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '分类ID',
  `parent_id` bigint NOT NULL DEFAULT 0 COMMENT '父级ID 0-顶级',
  `category_name` varchar(100) NOT NULL COMMENT '分类名称',
  `sort` int NOT NULL DEFAULT 0 COMMENT '排序（数值越小越靠前）',
  `deleted` tinyint NOT NULL DEFAULT 0 COMMENT '软删除',
  `create_user_id` bigint DEFAULT NULL COMMENT '创建人ID',
  `update_user_id` bigint DEFAULT NULL COMMENT '更新人ID',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_parent` (`parent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='文档分类表';

-- 预置分类
INSERT INTO `doc_category` (`category_name`, `sort`) VALUES
('Vue相关', 1), ('React相关', 2), ('构建工具', 3),
('CSS/样式', 4), ('浏览器兼容', 5), ('性能优化', 6),
('Node.js', 7), ('其他', 99);

-- 3. 前端问题文档表（核心）
CREATE TABLE `doc_issue` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '文档ID',
  `category_id` bigint NOT NULL COMMENT '分类ID',
  `title` varchar(200) NOT NULL COMMENT '问题标题',
  `problem` longtext COMMENT '问题描述（Markdown）',
  `solution` longtext COMMENT '解决方案（Markdown）',
  `tags` varchar(500) DEFAULT NULL COMMENT '标签，逗号分隔',
  `source` tinyint NOT NULL DEFAULT 1 COMMENT '来源 1-手动录入 2-钉钉自动采集',
  `status` tinyint NOT NULL DEFAULT 1 COMMENT '状态 0-待审核 1-已发布 2-驳回',
  `view_count` int NOT NULL DEFAULT 0 COMMENT '浏览次数',
  `create_user_id` bigint NOT NULL COMMENT '创建人ID',
  `update_user_id` bigint DEFAULT NULL COMMENT '更新人ID',
  `audit_user_id` bigint DEFAULT NULL COMMENT '审核人ID',
  `audit_time` datetime DEFAULT NULL COMMENT '审核时间',
  `audit_remark` varchar(500) DEFAULT NULL COMMENT '审核备注',
  `deleted` tinyint NOT NULL DEFAULT 0 COMMENT '软删除',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_category` (`category_id`),
  KEY `idx_status` (`status`),
  KEY `idx_create_user` (`create_user_id`),
  FULLTEXT KEY `ft_title_problem` (`title`, `problem`) WITH PARSER ngram
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='前端问题文档表';

-- 4. 钉钉应用配置表（修正：webhook → Stream API 凭证）
CREATE TABLE `sys_dingtalk` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `app_key` varchar(200) NOT NULL COMMENT '钉钉应用AppKey',
  `app_secret` varchar(200) NOT NULL COMMENT '钉钉应用AppSecret（加密存储）',
  `robot_code` varchar(100) DEFAULT NULL COMMENT '机器人编码',
  `group_ids` varchar(1000) DEFAULT NULL COMMENT '监听群ID列表，逗号分隔',
  `enable` tinyint NOT NULL DEFAULT 1 COMMENT '是否启用 0-关闭 1-启用',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='钉钉应用配置表';

-- 5. 钉钉消息采集表
CREATE TABLE `dingtalk_message` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `conversation_id` varchar(200) DEFAULT NULL COMMENT '会话ID',
  `msg_content` longtext NOT NULL COMMENT '消息内容',
  `sender` varchar(100) DEFAULT NULL COMMENT '发送人',
  `sender_id` varchar(100) DEFAULT NULL COMMENT '发送人钉钉ID',
  `send_time` datetime DEFAULT NULL COMMENT '发送时间',
  `handle_status` tinyint NOT NULL DEFAULT 0 COMMENT '处理状态 0-未处理 1-已生成文档 2-已忽略',
  `doc_id` bigint DEFAULT NULL COMMENT '关联生成的文档ID',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_handle_status` (`handle_status`),
  KEY `idx_doc` (`doc_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='钉钉消息表';

-- 6. RAG 向量库映射表（改为一对多，支持分片）
CREATE TABLE `rag_vector_mapping` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `doc_id` bigint NOT NULL COMMENT '文档ID',
  `vector_id` varchar(100) NOT NULL COMMENT '向量库中的ID',
  `chunk_index` int NOT NULL DEFAULT 0 COMMENT '分片序号',
  `chunk_content` text COMMENT '分片内容（便于向量重建）',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_doc` (`doc_id`),
  KEY `idx_vector` (`vector_id`),
  KEY `idx_doc_chunk` (`doc_id`, `chunk_index`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='RAG向量映射表';

-- 7. 系统配置表（存储 RAG 模型配置等）
CREATE TABLE `sys_config` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `config_key` varchar(100) NOT NULL COMMENT '配置键',
  `config_value` text COMMENT '配置值',
  `remark` varchar(200) DEFAULT NULL COMMENT '备注',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_config_key` (`config_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统配置表';

-- 预置 RAG 配置
INSERT INTO `sys_config` (`config_key`, `config_value`, `remark`) VALUES
('rag_embedding_model', 'text-embedding-v3', 'Embedding模型名称'),
('rag_embedding_api_key', '', 'Embedding API Key'),
('rag_embedding_base_url', 'https://dashscope.aliyuncs.com/compatible-mode/v1', 'Embedding API 地址'),
('rag_rerank_enabled', 'true', '是否启用Reranking'),
('rag_search_top_k', '20', '向量检索数量'),
('rag_rerank_top_n', '5', 'Rerank后返回数量'),
('rag_cache_ttl', '1800', 'RAG缓存TTL（秒）'),
('ai_model_name', 'qwen-plus', 'AI大模型名称'),
('ai_api_key', '', 'AI大模型API Key'),
('ai_base_url', 'https://dashscope.aliyuncs.com/compatible-mode/v1', 'AI大模型API地址');

-- 8. 操作审计日志
CREATE TABLE `sys_audit_log` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL COMMENT '操作人ID',
  `action` varchar(50) NOT NULL COMMENT '操作类型',
  `resource_type` varchar(50) NOT NULL COMMENT '资源类型',
  `resource_id` bigint NOT NULL DEFAULT 0 COMMENT '资源ID',
  `detail` varchar(500) DEFAULT NULL COMMENT '详情',
  `ip_address` varchar(64) DEFAULT NULL COMMENT 'IP',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_action` (`action`),
  KEY `idx_create_time` (`create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='操作审计日志';

-- 9. 文档版本历史
CREATE TABLE `doc_version` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `doc_id` bigint NOT NULL COMMENT '文档ID',
  `version_no` int NOT NULL COMMENT '版本号',
  `title` varchar(200) NOT NULL,
  `problem` longtext,
  `solution` longtext,
  `tags` varchar(500) DEFAULT NULL,
  `category_id` bigint NOT NULL,
  `editor_user_id` bigint NOT NULL COMMENT '编辑人',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_doc_version` (`doc_id`, `version_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='文档版本历史';
