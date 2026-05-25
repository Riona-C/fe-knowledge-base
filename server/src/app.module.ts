import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TerminusModule } from '@nestjs/terminus';
import { ConfigModule, APP_CONFIG, AppConfig } from './config';
import { winstonModule } from './config/winston.config';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import {
  UserEntity,
  CategoryEntity,
  DocIssueEntity,
  DingtalkConfigEntity,
  DingtalkMessageEntity,
  VectorMappingEntity,
  SysConfigEntity,
} from './entities';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { CategoryModule } from './modules/category/category.module';
import { DocModule } from './modules/doc/doc.module';
import { RagModule } from './modules/rag/rag.module';
import { DingtalkModule } from './modules/dingtalk/dingtalk.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    // 环境变量配置
    ConfigModule,
    // Winston 日志
    winstonModule(),
    // MySQL 数据库
    TypeOrmModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        type: 'mysql',
        host: config.database.host,
        port: config.database.port,
        username: config.database.username,
        password: config.database.password,
        database: config.database.database,
        entities: [
          UserEntity,
          CategoryEntity,
          DocIssueEntity,
          DingtalkConfigEntity,
          DingtalkMessageEntity,
          VectorMappingEntity,
          SysConfigEntity,
        ],
        synchronize: false,
        timezone: '+08:00',
        charset: 'utf8mb4',
      }),
    }),
    // 事件总线
    EventEmitterModule.forRoot(),
    // 接口限流：60 秒内最多 100 次请求
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    // 健康检查
    TerminusModule,
    // 业务模块
    AuthModule,
    UserModule,
    CategoryModule,
    DocModule,
    RagModule,
    DingtalkModule,
    HealthModule,
  ],
  providers: [
    // 全局 JWT 认证守卫
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // 全局角色守卫
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    // 全局限流守卫
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // 全局响应包装拦截器
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
  ],
})
export class AppModule {}
