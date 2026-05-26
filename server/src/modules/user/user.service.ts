import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { ApiResponse } from '../../common/dto/api-response';
import { UserEntity } from '../../entities/user.entity';
import { CreateUserDto, QueryUserDto, UpdateUserDto } from './user.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  /** 分页查询用户列表 */
  async list(query: QueryUserDto) {
    const qb = this.userRepo
      .createQueryBuilder('user')
      .where('user.deleted = 0');

    const searchKw = query.keyword || query.username;
    if (searchKw) {
      qb.andWhere(
        '(user.username LIKE :kw OR user.nickName LIKE :kw)',
        { kw: `%${searchKw}%` },
      );
    }
    if (query.status !== undefined) {
      qb.andWhere('user.status = :status', { status: query.status });
    }

    qb.orderBy('user.createTime', 'DESC');
    qb.skip(query.skip).take(query.take);

    const [list, total] = await qb.getManyAndCount();
    const safeList = list.map(({ password: _p, ...rest }) => rest);
    return ApiResponse.page(safeList, total, query.page ?? 1, query.pageSize ?? 20);
  }

  /** 创建用户 */
  async create(dto: CreateUserDto) {
    const exists = await this.userRepo.findOne({
      where: { username: dto.username, deleted: 0 },
    });
    if (exists) {
      throw new BadRequestException('用户名已存在');
    }

    const user = this.userRepo.create({
      username: dto.username,
      password: await bcrypt.hash(dto.password, 10),
      nickName: dto.nickName,
      role: dto.role,
      status: 1,
      deleted: 0,
    });
    const saved = await this.userRepo.save(user);
    const { password: _p, ...rest } = saved;
    return rest;
  }

  /** 更新用户 */
  async update(id: number, dto: UpdateUserDto) {
    const user = await this.findActiveUser(id);
    Object.assign(user, dto);
    const saved = await this.userRepo.save(user);
    const { password: _p, ...rest } = saved;
    return rest;
  }

  /** 软删除用户 */
  async remove(id: number): Promise<void> {
    const user = await this.findActiveUser(id);
    user.deleted = 1;
    await this.userRepo.save(user);
  }

  private async findActiveUser(id: number): Promise<UserEntity> {
    const user = await this.userRepo.findOne({
      where: { id, deleted: 0 },
    });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    return user;
  }
}
