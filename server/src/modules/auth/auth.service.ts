import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UserEntity } from '../../entities/user.entity';
import { ChangePasswordDto, LoginDto } from './auth.dto';

/** Token 响应结构 */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/** JWT 载荷 */
interface TokenPayload {
  sub: number;
  username: string;
  role: string;
  type?: 'refresh';
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly jwtService: JwtService,
  ) {}

  /** 用户登录 */
  async login(dto: LoginDto): Promise<TokenPair> {
    const user = await this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.username = :username', { username: dto.username })
      .andWhere('user.deleted = 0')
      .getOne();

    if (!user || user.status !== 1) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    return this.generateTokens(user);
  }

  /** 刷新访问令牌（轮换 refreshToken） */
  async refresh(refreshToken: string): Promise<TokenPair> {
    try {
      const payload = this.jwtService.verify<TokenPayload>(refreshToken);
      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('无效的刷新令牌');
      }

      const user = await this.userRepo.findOne({
        where: { id: payload.sub, deleted: 0, status: 1 },
      });
      if (!user) {
        throw new UnauthorizedException('用户不存在或已被禁用');
      }

      return this.generateTokens(user);
    } catch {
      throw new UnauthorizedException('刷新令牌无效或已过期');
    }
  }

  /** 获取当前用户信息 */
  async getInfo(userId: number) {
    const user = await this.userRepo.findOne({
      where: { id: userId, deleted: 0 },
    });
    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }
    const { password: _pwd, deleted: _del, ...info } = user;
    return info;
  }

  /** 修改密码 */
  async changePassword(userId: number, dto: ChangePasswordDto): Promise<void> {
    const user = await this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.id = :id', { id: userId })
      .andWhere('user.deleted = 0')
      .getOne();

    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    const valid = await bcrypt.compare(dto.oldPassword, user.password);
    if (!valid) {
      throw new BadRequestException('旧密码不正确');
    }

    user.password = await bcrypt.hash(dto.newPassword, 10);
    await this.userRepo.save(user);
  }

  /** Passport 策略校验用户 */
  async validateUser(userId: number): Promise<UserEntity | null> {
    return this.userRepo.findOne({
      where: { id: userId, deleted: 0, status: 1 },
    });
  }

  /** 生成 accessToken + refreshToken */
  private generateTokens(user: UserEntity): TokenPair {
    const payload: TokenPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m',
    });

    const refreshToken = this.jwtService.sign(
      { ...payload, type: 'refresh' },
      { expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d' },
    );

    return { accessToken, refreshToken };
  }
}
