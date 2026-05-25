import {
  Body,
  Controller,
  Delete,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { RagService } from './rag.service';
import { SearchDto } from './rag.dto';

@ApiTags('RAG 检索')
@ApiBearerAuth()
@Controller('rag')
export class RagController {
  constructor(private readonly ragService: RagService) { }

  @Post('search')
  @ApiOperation({ summary: '智能检索相似问题' })
  search(@Body() dto: SearchDto) {
    return this.ragService.search(dto.query, dto.topK);
  }

  @Roles('admin')
  @Post('sync/all')
  @ApiOperation({ summary: '全量同步所有已发布文档到向量库' })
  syncAll() {
    return this.ragService.syncAll();
  }

  @Roles('admin')
  @Post('sync/:docId')
  @ApiOperation({ summary: '手动同步单篇文档到向量库' })
  syncDoc(@Param('docId', ParseIntPipe) docId: number) {
    return this.ragService.syncDoc(docId);
  }

  @Roles('admin')
  @Delete('sync/:docId')
  @ApiOperation({ summary: '手动删除文档向量' })
  removeDoc(@Param('docId', ParseIntPipe) docId: number) {
    return this.ragService.removeDoc(docId);
  }
}
