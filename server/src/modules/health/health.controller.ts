import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  DiskHealthIndicator,
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import Redis from 'ioredis';
import { Public } from '../../common/decorators/public.decorator';
import { REDIS_CLIENT } from '../../common/providers/redis.module';
import { RagChromaService } from '../rag/rag-chroma.service';

@ApiTags('健康检查')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private disk: DiskHealthIndicator,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly chromaService: RagChromaService,
  ) {}

  @Public()
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () =>
        this.disk.checkStorage('disk', {
          path: process.platform === 'win32' ? 'C:\\' : '/',
          thresholdPercent: 0.9,
        }),
      async () => {
        try {
          const pong = await this.redis.ping();
          return { redis: { status: pong === 'PONG' ? 'up' : 'down' } };
        } catch (e) {
          return { redis: { status: 'down', message: String(e) } };
        }
      },
      async () => {
        try {
          const ok = await this.chromaService.ping();
          return { chroma: { status: ok ? 'up' : 'down' } };
        } catch (e) {
          return { chroma: { status: 'down', message: String(e) } };
        }
      },
    ]);
  }
}
