import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CategoryEntity } from '../../entities/category.entity';
import { DocIssueEntity } from '../../entities/doc-issue.entity';
import { CreateCategoryDto, UpdateCategoryDto } from './category.dto';

@Injectable()
export class CategoryService {
  constructor(
    @InjectRepository(CategoryEntity)
    private readonly categoryRepo: Repository<CategoryEntity>,
    @InjectRepository(DocIssueEntity)
    private readonly docRepo: Repository<DocIssueEntity>,
  ) {}

  /** 获取分类树 */
  async getTree(): Promise<CategoryEntity[]> {
    const list = await this.categoryRepo.find({
      where: { deleted: 0 },
      order: { sort: 'ASC', id: 'ASC' },
    });
    return this.buildTree(list);
  }

  /** 获取分类平铺列表 */
  async getList(): Promise<CategoryEntity[]> {
    return this.categoryRepo.find({
      where: { deleted: 0 },
      order: { sort: 'ASC', id: 'ASC' },
    });
  }

  /** 新增分类 */
  async create(dto: CreateCategoryDto, userId?: number) {
    const category = this.categoryRepo.create({
      categoryName: dto.categoryName,
      parentId: dto.parentId ?? 0,
      sort: dto.sort ?? 0,
      createUserId: userId,
      deleted: 0,
    });
    return this.categoryRepo.save(category);
  }

  /** 编辑分类 */
  async update(id: number, dto: UpdateCategoryDto, userId?: number) {
    const category = await this.findActive(id);
    if (dto.parentId !== undefined && dto.parentId === id) {
      throw new BadRequestException('父分类不能为自身');
    }
    Object.assign(category, dto, { updateUserId: userId });
    return this.categoryRepo.save(category);
  }

  /** 软删除分类 */
  async remove(id: number): Promise<void> {
    const category = await this.findActive(id);

    const childCount = await this.categoryRepo.count({
      where: { parentId: id, deleted: 0 },
    });
    if (childCount > 0) {
      throw new BadRequestException('存在子分类，无法删除');
    }

    const docCount = await this.docRepo.count({
      where: { categoryId: id, deleted: 0 },
    });
    if (docCount > 0) {
      throw new BadRequestException('分类下存在关联文档，无法删除');
    }

    category.deleted = 1;
    await this.categoryRepo.save(category);
  }

  private async findActive(id: number): Promise<CategoryEntity> {
    const category = await this.categoryRepo.findOne({
      where: { id, deleted: 0 },
    });
    if (!category) {
      throw new NotFoundException('分类不存在');
    }
    return category;
  }

  /** 组装树形结构 */
  private buildTree(list: CategoryEntity[], parentId = 0): CategoryEntity[] {
    return list
      .filter((item) => Number(item.parentId) === parentId)
      .map((item) => ({
        ...item,
        children: this.buildTree(list, Number(item.id)),
      }));
  }
}
