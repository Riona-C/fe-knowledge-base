import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { APP_CONFIG, AppConfig } from '../../config';
import { JwtPayload } from '../../common/decorators/current-user.decorator';

/** JWT Token 原始载荷 */
interface JwtTokenPayload {
  sub: number;
  username: string;
  role: string;
}
import { UserEntity } from '../../entities';

/** JWT  Passport 策略 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(APP_CONFIG) config: AppConfig,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.jwt.secret,
    });
  }

  async validate(payload: JwtTokenPayload): Promise<JwtPayload> {
    const user = await this.userRepo.findOne({
      where: { id: payload.sub, deleted: 0, status: 1 },
    });
    if (!user) {
      throw new UnauthorizedException('用户不存在或已被禁用');
    }
    return {
      userId: user.id,
      username: user.username,
      role: user.role,
    };
  }
}
