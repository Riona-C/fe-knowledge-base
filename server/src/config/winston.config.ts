import { existsSync, mkdirSync } from 'fs';
import { utilities, WinstonModule } from 'nest-winston';
import * as winston from 'winston';

// 确保日志目录存在
if (!existsSync('logs')) {
  mkdirSync('logs', { recursive: true });
}

/** Winston 传输配置 */
const winstonTransports = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.ms(),
      utilities.format.nestLike('FeKnowledge', { prettyPrint: true }),
    ),
  }),
  new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
    format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  }),
  new winston.transports.File({
    filename: 'logs/combined.log',
    format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  }),
];

/** 注册到 AppModule 的 Winston 动态模块 */
export function winstonModule() {
  return WinstonModule.forRoot({ transports: winstonTransports });
}

/** 用于 NestFactory.create 的 Winston 日志实例 */
export function createWinstonLogger() {
  return WinstonModule.createLogger({ transports: winstonTransports });
}
