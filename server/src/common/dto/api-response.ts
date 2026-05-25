/** 统一 API 响应格式 */
export class ApiResponse<T = unknown> {
  /** 业务状态码，0 表示成功 */
  code: number;

  /** 提示信息 */
  message: string;

  /** 响应数据 */
  data: T;

  /** 时间戳 */
  timestamp: number;

  constructor(code: number, message: string, data: T) {
    this.code = code;
    this.message = message;
    this.data = data;
    this.timestamp = Date.now();
  }

  /** 成功响应 */
  static success<T>(data?: T, message = '操作成功'): ApiResponse<T> {
    return new ApiResponse<T>(0, message, data as T);
  }

  /** 失败响应 */
  static error(message = '操作失败', code = -1): ApiResponse<null> {
    return new ApiResponse<null>(code, message, null);
  }

  /** 分页响应 */
  static page<T>(
    list: T[],
    total: number,
    page: number,
    pageSize: number,
    message = '查询成功',
  ): ApiResponse<{ list: T[]; total: number; page: number; pageSize: number }> {
    return new ApiResponse(0, message, { list, total, page, pageSize });
  }
}
