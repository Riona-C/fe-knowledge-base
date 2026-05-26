import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TerminusModule } from '@nestjs/terminus';
import { ConfigModule, APP_CONFIG, AppConfig } from './config';
import { winstonModule } from './config/winston.config';
import { RedisModule } from './common/providers/redis.module';
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
  AuditLogEntity,
  DocVersionEntity,
} from './entities';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { CategoryModule } from './modules/category/category.module';
import { DocModule } from './modules/doc/doc.module';
import { RagModule } from './modules/rag/rag.module';
import { DingtalkModule } from './modules/dingtalk/dingtalk.module';
import { HealthModule } from './modules/health/health.module';
import { AuditModule } from './modules/audit/audit.module';

@Module({
  imports: [
    ConfigModule,
    RedisModule,
    AuditModule,
    winstonModule(),
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
          AuditLogEntity,
          DocVersionEntity,
        ],
        synchronize: false,
        timezone: '+08:00',
        charset: 'utf8mb4',
      }),
    }),
    EventEmitterModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    TerminusModule,
    AuthModule,
    UserModule,
    CategoryModule,
    DocModule,
    RagModule,
    DingtalkModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
  ],
})
export class AppModule {}
