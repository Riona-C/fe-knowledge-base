import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { DingtalkService } from './dingtalk.service';
import { QueryMessageDto, TestMessageDto, UpdateAutoDetectDto, UpdateDingtalkConfigDto } from './dingtalk.dto';

@ApiTags('钉钉采集')
@ApiBearerAuth()
@Controller('dingtalk')
export class DingtalkController {
  constructor(private readonly dingtalkService: DingtalkService) {}

  @Roles('admin')
  @Get('config')
  @ApiOperation({ summary: '获取钉钉配置' })
  getConfig() {
    return this.dingtalkService.getConfig();
  }

  @Roles('admin')
  @Put('config')
  @ApiOperation({ summary: '更新钉钉配置' })
  updateConfig(@Body() dto: UpdateDingtalkConfigDto) {
    return this.dingtalkService.updateConfig(dto);
  }

  @Roles('admin')
  @Get('messages')
  @ApiOperation({ summary: '采集消息列表（分页）' })
  getMessages(@Query() query: QueryMessageDto) {
    return this.dingtalkService.getMessages(query);
  }

  @Roles('admin')
  @Post('messages/:id/generate')
  @ApiOperation({ summary: '手动生成文档' })
  generateDoc(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.dingtalkService.generateDoc(id, user.userId);
  }

  @Roles('admin')
  @Post('messages/:id/ignore')
  @ApiOperation({ summary: '忽略消息' })
  ignoreMessage(@Param('id', ParseIntPipe) id: number) {
    return this.dingtalkService.ignoreMessage(id);
  }

  @Roles('admin')
  @Get('auto-detect/config')
  @ApiOperation({ summary: '获取自动检测配置' })
  getAutoDetectConfig() {
    return this.dingtalkService.getAutoDetectConfig();
  }

  @Roles('admin')
  @Put('auto-detect/config')
  @ApiOperation({ summary: '更新自动检测配置' })
  updateAutoDetectConfig(@Body() dto: UpdateAutoDetectDto) {
    return this.dingtalkService.updateAutoDetectConfig(dto);
  }

  @Roles('admin')
  @Post('auto-detect/scan')
  @ApiOperation({ summary: '批量扫描未处理消息（关键词检测+AI提取）' })
  batchScan() {
    return this.dingtalkService.batchScan();
  }

  @Roles('admin')
  @Post('test-message')
  @ApiOperation({ summary: '模拟消息（绕过Stream，测试完整处理链路）' })
  testMessage(@Body() dto: TestMessageDto) {
    return this.dingtalkService.onMessage({
      conversationId: 'test_' + Date.now(),
      msgContent: dto.content,
      sender: dto.sender || '测试用户',
      senderId: 'test_user',
      sendTime: new Date(),
    });
  }
}
