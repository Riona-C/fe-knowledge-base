import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { createAppConfig } from './config';
import { createWinstonLogger } from './config/winston.config';

async function bootstrap() {
  const config = createAppConfig();

  const app = await NestFactory.create(AppModule, {
    logger: createWinstonLogger(),
  });

  // 使用 Winston 作为 Nest 日志提供者
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  // 启用跨域
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // 全局 API 前缀
  app.setGlobalPrefix('api');

  // 全局校验管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      forbidNonWhitelisted: true,
    }),
  );

  // 全局异常过滤器
  app.useGlobalFilters(new HttpExceptionFilter(app.get(WINSTON_MODULE_NEST_PROVIDER)));

  // Swagger 文档
  const swaggerConfig = new DocumentBuilder()
    .setTitle('前端知识库 API')
    .setDescription('前端踩坑知识库 RAG 系统 - 后端接口文档')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(config.port);
  const logger = app.get(WINSTON_MODULE_NEST_PROVIDER);
  logger.log(`服务已启动: http://localhost:${config.port}/api`, 'Bootstrap');
  logger.log(`Swagger 文档: http://localhost:${config.port}/api/docs`, 'Bootstrap');
}

bootstrap();
