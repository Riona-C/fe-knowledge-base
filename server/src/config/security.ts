import { DEFAULT_DB_PASSWORD, DEFAULT_JWT_SECRET } from '../common/constants';

const INSECURE_JWT_SECRETS = new Set([
  DEFAULT_JWT_SECRET,
  'change-me',
  'secret',
]);

const INSECURE_DB_PASSWORDS = new Set([
  DEFAULT_DB_PASSWORD,
  'password',
  'root',
]);

export function isProductionEnv(): boolean {
  return process.env.NODE_ENV === 'production';
}

/** 生产环境启动前校验关键密钥，未配置则拒绝启动 */
export function validateProductionSecrets(): void {
  if (!isProductionEnv()) {
    return;
  }

  const jwtSecret = process.env.JWT_SECRET ?? '';
  const dbPassword = process.env.DB_PASSWORD ?? '';

  const errors: string[] = [];

  if (!jwtSecret || INSECURE_JWT_SECRETS.has(jwtSecret)) {
    errors.push('生产环境必须设置强随机 JWT_SECRET（不可使用默认值）');
  }
  if (!dbPassword || INSECURE_DB_PASSWORDS.has(dbPassword)) {
    errors.push('生产环境必须设置强随机 DB_PASSWORD（不可使用 root123 等弱密码）');
  }
  if (process.env.SWAGGER_ENABLED === 'true') {
    errors.push('生产环境请勿设置 SWAGGER_ENABLED=true');
  }

  if (errors.length > 0) {
    throw new Error(`安全配置校验失败:\n- ${errors.join('\n- ')}`);
  }
}
