import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CategoryService } from './category.service';
import { CreateCategoryDto, UpdateCategoryDto } from './category.dto';

@ApiTags('分类管理')
@ApiBearerAuth()
@Controller('category')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get('tree')
  @ApiOperation({ summary: '分类树形列表' })
  getTree() {
    return this.categoryService.getTree();
  }

  @Get('list')
  @ApiOperation({ summary: '分类平铺列表' })
  getList() {
    return this.categoryService.getList();
  }

  @Roles('admin')
  @Post()
  @ApiOperation({ summary: '新增分类' })
  create(@Body() dto: CreateCategoryDto, @CurrentUser() user: JwtPayload) {
    return this.categoryService.create(dto, user.userId);
  }

  @Roles('admin')
  @Put(':id')
  @ApiOperation({ summary: '编辑分类' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCategoryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.categoryService.update(id, dto, user.userId);
  }

  @Roles('admin')
  @Delete(':id')
  @ApiOperation({ summary: '删除分类（软删除）' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.categoryService.remove(id);
  }
}
