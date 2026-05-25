import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { Global, Module } from '@nestjs/common';

/** 应用配置结构 */
export interface AppConfig {
  port: number;
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
  };
  redis: {
    host: string;
    port: number;
    password: string;
  };
  jwt: {
    secret: string;
    accessExpires: string;
    refreshExpires: string;
  };
  rag: {
    embeddingModel: string;
    embeddingApiKey: string;
    embeddingBaseUrl: string;
    chromaHost: string;
    chromaPort: number;
    chromaCollection: string;
  };
  ai: {
    modelName: string;
    apiKey: string;
    baseUrl: string;
  };
  dingtalk: {
    appKey: string;
    appSecret: string;
    robotCode: string;
  };
  upload: {
    dir: string;
    maxFileSize: number;
  };
}

export const APP_CONFIG = 'APP_CONFIG';

/** 从 .env 文件加载环境变量（无第三方依赖） */
function loadEnvFile(): void {
  const envPath = join(process.cwd(), '.env');
  if (!existsSync(envPath)) {
    return;
  }
  const content = readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) {
      continue;
    }
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

/** 读取环境变量，带默认值 */
function env(key: string, defaultValue = ''): string {
  return process.env[key] ?? defaultValue;
}

function envInt(key: string, defaultValue: number): number {
  const val = process.env[key];
  return val ? parseInt(val, 10) : defaultValue;
}

/** 配置工厂：从环境变量构建结构化配置对象 */
export function createAppConfig(): AppConfig {
  loadEnvFile();
  return {
    port: envInt('PORT', 3000),
    database: {
      host: env('DB_HOST', 'localhost'),
      port: envInt('DB_PORT', 3306),
      username: env('DB_USERNAME', 'root'),
      password: env('DB_PASSWORD', 'root123'),
      database: env('DB_DATABASE', 'fe_knowledge'),
    },
    redis: {
      host: env('REDIS_HOST', 'localhost'),
      port: envInt('REDIS_PORT', 6379),
      password: env('REDIS_PASSWORD', ''),
    },
    jwt: {
      secret: env('JWT_SECRET', 'fe-knowledge-jwt-secret-key-2024'),
      accessExpires: env('JWT_ACCESS_EXPIRES', '15m'),
      refreshExpires: env('JWT_REFRESH_EXPIRES', '7d'),
    },
    rag: {
      embeddingModel: env('RAG_EMBEDDING_MODEL', 'text-embedding-v3'),
      embeddingApiKey: env('RAG_EMBEDDING_API_KEY', ''),
      embeddingBaseUrl: env(
        'RAG_EMBEDDING_BASE_URL',
        'https://dashscope.aliyuncs.com/compatible-mode/v1',
      ),
      chromaHost: env('CHROMA_HOST', 'localhost'),
      chromaPort: envInt('CHROMA_PORT', 8000),
      chromaCollection: env('CHROMA_COLLECTION', 'fe_knowledge'),
    },
    ai: {
      modelName: env('AI_MODEL_NAME', 'qwen-plus'),
      apiKey: env('AI_API_KEY', ''),
      baseUrl: env('AI_BASE_URL', 'https://dashscope.aliyuncs.com/compatible-mode/v1'),
    },
    dingtalk: {
      appKey: env('DINGTALK_APP_KEY', ''),
      appSecret: env('DINGTALK_APP_SECRET', ''),
      robotCode: env('DINGTALK_ROBOT_CODE', ''),
    },
    upload: {
      dir: env('UPLOAD_DIR', './uploads'),
      maxFileSize: envInt('MAX_FILE_SIZE', 10485760),
    },
  };
}

/** 全局配置模块，注入 APP_CONFIG 供各模块使用 */
@Global()
@Module({
  providers: [
    {
      provide: APP_CONFIG,
      useFactory: createAppConfig,
    },
  ],
  exports: [APP_CONFIG],
})
export class ConfigModule {}
