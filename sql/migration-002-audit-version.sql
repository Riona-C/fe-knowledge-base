-- 审计日志 + 文档版本历史（已有库执行此脚本）
USE `fe_knowledge`;

CREATE TABLE IF NOT EXISTS `sys_audit_log` (
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

CREATE TABLE IF NOT EXISTS `doc_version` (
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

ALTER TABLE `rag_vector_mapping`
  ADD KEY `idx_doc_chunk` (`doc_id`, `chunk_index`);
