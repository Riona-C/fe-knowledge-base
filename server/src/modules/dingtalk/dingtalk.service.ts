import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Redis from 'ioredis';
import { InjectRepository } from '@nestjs/typeorm';
import { DWClient, DWClientDownStream, TOPIC_ROBOT } from 'dingtalk-stream';
import OpenAI from 'openai';
import { Repository } from 'typeorm';
import { APP_CONFIG, AppConfig } from '../../config';
import { SYSTEM_USER_ID } from '../../common/constants';
import { REDIS_CLIENT } from '../../common/providers/redis.module';
import { decryptSecret, encryptSecret } from '../../common/utils/crypto.util';
import { ApiResponse } from '../../common/dto/api-response';
import { CategoryEntity } from '../../entities/category.entity';
import { DingtalkConfigEntity } from '../../entities/dingtalk-config.entity';
import { DingtalkMessageEntity } from '../../entities/dingtalk-message.entity';
import { DocIssueEntity } from '../../entities/doc-issue.entity';
import { SysConfigEntity } from '../../entities/sys-config.entity';
import {
  AT_BOT_EMPTY_PATTERNS,
  AT_BOT_REPLY_SKIP,
  AT_BOT_REPLY_SUCCESS,
  AT_BOT_REPLY_USAGE,
  AUTO_DETECT_AI_PROMPT,
  AUTO_DETECT_DEBOUNCE_MS,
  AUTO_DETECT_KEYWORDS,
  AUTO_DETECT_WORD_KEYWORDS,
  CONTEXT_TIME_WINDOW_MIN,
  CONTEXT_WINDOW_SIZE,
} from './dingtalk.constants';
import { QueryMessageDto, UpdateAutoDetectDto, UpdateDingtalkConfigDto } from './dingtalk.dto';

interface AiDocResult {
  title: string;
  problem: string;
  solution: string;
  tags: string;
}

interface AutoDetectAiResult {
  skip?: boolean;
  title?: string;
  problem?: string;
  solution?: string;
  tags?: string;
  categoryName?: string;
}

interface DingtalkApiMessage {
  senderId?: string;
  senderNick?: string;
  content?: string;
  createAt?: number;
}

@Injectable()
export class DingtalkService implements OnModuleInit {
  private readonly logger = new Logger(DingtalkService.name);
  private streamClient: DWClient | null = null;
  private readonly aiClient: OpenAI;
  /** 防抖：记录每个会话最近一次自动触发的时间戳 */
  private readonly autoDetectLastTrigger = new Map<string, number>();
  /** 钉钉 AccessToken 缓存 */
  private dingtalkAccessToken: string | null = null;
  private dingtalkTokenExpireAt = 0;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @InjectRepository(CategoryEntity)
    private readonly categoryRepo: Repository<CategoryEntity>,
    @InjectRepository(DingtalkConfigEntity)
    private readonly configRepo: Repository<DingtalkConfigEntity>,
    @InjectRepository(DingtalkMessageEntity)
    private readonly messageRepo: Repository<DingtalkMessageEntity>,
    @InjectRepository(DocIssueEntity)
    private readonly docRepo: Repository<DocIssueEntity>,
    @InjectRepository(SysConfigEntity)
    private readonly sysConfigRepo: Repository<SysConfigEntity>,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.aiClient = new OpenAI({
      apiKey: config.ai.apiKey,
      baseURL: config.ai.baseUrl,
    });
  }

  async onModuleInit() {
    const cfg = await this.getActiveConfig();
    if (cfg?.enable === 1) {
      await this.startStream();
    }
  }

  /** 获取钉钉配置（API 脱敏） */
  async getConfig() {
    const config = await this.getConfigEntity();
    if (!config) {
      return null;
    }
    return {
      ...config,
      appSecret: config.appSecret ? '********' : '',
    };
  }

  /** 更新钉钉配置 */
  async updateConfig(dto: UpdateDingtalkConfigDto) {
    let config = await this.getConfigEntity();
    const payload = { ...dto };
    if (payload.appSecret?.includes('*')) {
      delete (payload as { appSecret?: string }).appSecret;
    } else if (payload.appSecret) {
      payload.appSecret = encryptSecret(payload.appSecret, this.getEncryptKey());
    }
    if (!config) {
      config = this.configRepo.create(payload);
    } else {
      Object.assign(config, payload);
    }
    const saved = await this.configRepo.save(config);

    if (saved.enable === 1) {
      await this.startStream();
    } else {
      await this.stopStream();
    }
    return saved;
  }

  /** 分页查询采集消息 */
  async getMessages(query: QueryMessageDto) {
    const qb = this.messageRepo.createQueryBuilder('msg');

    if (query.handleStatus !== undefined) {
      qb.andWhere('msg.handleStatus = :handleStatus', {
        handleStatus: query.handleStatus,
      });
    }
    if (query.sender) {
      qb.andWhere('msg.sender LIKE :sender', {
        sender: `%${query.sender}%`,
      });
    }

    qb.orderBy('msg.createTime', 'DESC');
    qb.skip(query.skip).take(query.take);

    const [list, total] = await qb.getManyAndCount();
    return ApiResponse.page(list, total, query.page ?? 1, query.pageSize ?? 20);
  }

  /** 手动生成文档（带上下文分析 + 智能分类） */
  async generateDoc(messageId: number, userId: number) {
    const message = await this.findMessage(messageId);
    if (message.handleStatus === 1) {
      throw new BadRequestException('消息已生成文档');
    }

    const contextText = await this.gatherContextText(message);
    const categories = await this.getAllCategories();
    const parsed = await this.extractWithAutoDetect(contextText, categories);

    if (parsed.skip || !parsed.title || !parsed.problem) {
      throw new BadRequestException('AI 未能从上下文中提取有效文档内容');
    }

    const categoryId = await this.resolveCategoryId(parsed.categoryName, categories);

    const doc = this.docRepo.create({
      categoryId,
      title: parsed.title,
      problem: parsed.problem,
      solution: parsed.solution || '待补充',
      tags: parsed.tags || '',
      source: 2,
      status: 0,
      createUserId: userId,
      deleted: 0,
    });
    const saved = await this.docRepo.save(doc);
    this.eventEmitter.emit('doc.created', { docId: saved.id });

    message.handleStatus = 1;
    message.docId = saved.id;
    await this.messageRepo.save(message);

    return saved;
  }

  /** 忽略消息 */
  async ignoreMessage(messageId: number) {
    const message = await this.findMessage(messageId);
    message.handleStatus = 2;
    await this.messageRepo.save(message);
  }

  /** 启动钉钉 Stream 连接 */
  async startStream() {
    const cfg = await this.getActiveConfig();
    if (!cfg) {
      this.logger.warn('钉钉配置不存在，跳过 Stream 启动');
      return;
    }

    await this.stopStream();

    this.streamClient = new DWClient({
      clientId: cfg.appKey,
      clientSecret: this.decryptAppSecret(cfg.appSecret),
      keepAlive: true,
      debug: false,
    });

    this.streamClient.registerCallbackListener(
      TOPIC_ROBOT,
      async (msg: DWClientDownStream) => {
        this.logger.log(`[Stream回调] 收到消息, messageId=${msg.headers?.messageId}`);
        try {
          const data = JSON.parse(msg.data);
          const conversationType = data.conversationType ?? data.conversation_type;
          const isGroupChat = conversationType === '2';
          const isAtBot = isGroupChat
            ? (data.isInAtList === true || data.isInAtList === 'true')
            : true;
          this.logger.log(
            `[Stream回调] 解析成功, conversationId=${data.conversationId}, sender=${data.senderNick}, isGroup=${isGroupChat}, isAtBot=${isAtBot}`,
          );
          await this.onMessage({
            conversationId: data.conversationId ?? data.conversation_id,
            msgContent:
              data.text?.content ?? data.content ?? JSON.stringify(data),
            sender: data.senderNick ?? data.sender_nick,
            senderId: data.senderId ?? data.sender_id,
            sendTime: data.createAt ? new Date(data.createAt) : new Date(),
            isAtBot,
          });
          this.streamClient?.socketCallBackResponse(msg.headers.messageId, {
            success: true,
          });
          this.logger.log('[Stream回调] 消息处理完毕');
        } catch (err) {
          this.logger.error('处理钉钉消息失败', err);
        }
      },
    );

    this.streamClient.on('error', (err) => {
      this.logger.error('钉钉 Stream WebSocket 异常', err);
    });

    await this.streamClient.connect();
    this.logger.log(`钉钉 Stream 连接已启动 (keepAlive=true), appKey=${cfg.appKey.slice(0, 8)}...`);
  }

  /** 获取自动检测配置 */
  async getAutoDetectConfig() {
    const enabled = await this.sysConfigRepo.findOne({
      where: { configKey: 'dingtalk.auto_detect_enabled' },
    });
    const keywords = await this.sysConfigRepo.findOne({
      where: { configKey: 'dingtalk.auto_detect_keywords' },
    });
    return {
      enabled: enabled?.configValue === 'true',
      keywords: keywords?.configValue || AUTO_DETECT_KEYWORDS.join(','),
    };
  }

  /** 更新自动检测配置 */
  async updateAutoDetectConfig(dto: UpdateAutoDetectDto) {
    await this.upsertSysConfig(
      'dingtalk.auto_detect_enabled',
      String(dto.enabled),
      '群聊自动检测开关',
    );
    if (dto.keywords) {
      await this.upsertSysConfig(
        'dingtalk.auto_detect_keywords',
        dto.keywords,
        '自动检测关键词列表（逗号分隔）',
      );
    }
  }

  /** 接收并存储群消息 */
  async onMessage(data: {
    conversationId?: string;
    msgContent: string;
    sender?: string;
    senderId?: string;
    sendTime?: Date;
    isAtBot?: boolean;
  }) {
    const cfg = await this.getActiveConfig();
    if (!cfg || cfg.enable !== 1) {
      return;
    }

    if (cfg.groupIds) {
      const allowed = cfg.groupIds.split(',').map((s) => s.trim());
      if (
        data.conversationId &&
        allowed.length > 0 &&
        !allowed.includes(data.conversationId)
      ) {
        return;
      }
    }

    const message = this.messageRepo.create({
      conversationId: data.conversationId,
      msgContent: data.msgContent,
      sender: data.sender,
      senderId: data.senderId,
      sendTime: data.sendTime ?? new Date(),
      handleStatus: 0,
    });
    const saved = await this.messageRepo.save(message);

    this.tryAutoDetect(saved, data.isAtBot ?? false).catch((err) => {
      this.logger.error('自动检测处理失败', err);
    });
  }

  private async stopStream() {
    if (this.streamClient) {
      try {
        this.streamClient.removeAllListeners();
        await this.streamClient.disconnect();
      } catch {
        // 忽略断开连接异常
      }
      this.streamClient = null;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  private async getActiveConfig() {
    return this.getConfigEntity();
  }

  private async findMessage(id: number): Promise<DingtalkMessageEntity> {
    const message = await this.messageRepo.findOne({ where: { id } });
    if (!message) {
      throw new NotFoundException('消息不存在');
    }
    return message;
  }

  private async getDefaultCategoryId(): Promise<number> {
    const row = await this.sysConfigRepo.findOne({
      where: { configKey: 'dingtalk.default_category_id' },
    });
    return row?.configValue ? parseInt(row.configValue, 10) : 1;
  }

  /**
   * 自动检测入口：
   * - isAtBot=true → 直接分析@消息本身内容（不依赖历史上下文）
   * - isAtBot=false → 走关键词匹配 + 防抖逻辑
   */
  private async tryAutoDetect(message: DingtalkMessageEntity, isAtBot = false) {
    if (!isAtBot) {
      const detectConfig = await this.getAutoDetectConfig();
      if (!detectConfig.enabled) {
        return;
      }
      const keywords = detectConfig.keywords
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);
      if (!this.matchKeywords(message.msgContent, keywords)) {
        return;
      }
      const convKey = message.conversationId || `single_${message.id}`;
      const lastTrigger = this.autoDetectLastTrigger.get(convKey) ?? 0;
      if (Date.now() - lastTrigger < AUTO_DETECT_DEBOUNCE_MS) {
        this.logger.debug(`会话 ${convKey} 防抖跳过`);
        return;
      }
      this.autoDetectLastTrigger.set(convKey, Date.now());
    }

    if (isAtBot) {
      await this.handleAtBotMessage(message);
      return;
    }

    // 关键词触发：仍走上下文聚合逻辑
    this.logger.log(`[关键词触发] 消息ID=${message.id}，开始拉取上下文并自动提取...`);
    const contextText = await this.gatherContextText(message);
    const categories = await this.getAllCategories();
    const result = await this.extractWithAutoDetect(contextText, categories);

    if (result.skip || !result.title || !result.problem) {
      this.logger.log(`AI判定消息无有效技术内容，跳过。消息ID=${message.id}`);
      return;
    }

    await this.createDocFromResult(result, message, categories);
  }

  /**
   * @机器人 触发：直接分析消息内容本身
   * 钉钉机器人只能收到 @bot 的消息，无法获取群内其他消息历史，
   * 因此要求用户在 @bot 时附带技术问题描述
   */
  private async handleAtBotMessage(message: DingtalkMessageEntity) {
    const content = (message.msgContent || '').trim();

    // 消息内容过短或属于空泛指令 → 回复使用引导
    if (this.isEmptyCommand(content)) {
      this.logger.log(`[@机器人] 消息内容为空泛指令，回复使用引导。消息ID=${message.id}`);
      if (message.conversationId) {
        await this.sendGroupReplyRaw(message.conversationId, AT_BOT_REPLY_USAGE);
      }
      return;
    }

    this.logger.log(`[@机器人触发] 消息ID=${message.id}，直接分析消息内容...`);

    // 以消息本身内容 + 本地DB中同会话近期消息作为补充上下文
    const contextText = await this.buildAtBotContext(message);
    const categories = await this.getAllCategories();
    const result = await this.extractWithAutoDetect(contextText, categories);

    if (result.skip || !result.title || !result.problem) {
      this.logger.log(`AI判定消息无有效技术内容，跳过。消息ID=${message.id}`);
      if (message.conversationId) {
        await this.sendGroupReply(message.conversationId, null);
      }
      return;
    }

    const saved = await this.createDocFromResult(result, message, categories);

    if (saved && message.conversationId) {
      const categoryId = saved.categoryId;
      const allCategories = await this.getAllCategories();
      const category = allCategories.find((c) => c.id === categoryId);
      await this.sendGroupReply(message.conversationId, {
        title: result.title,
        categoryName: category?.categoryName || result.categoryName || '未分类',
        tags: result.tags || '无',
      });
    }
  }

  /** 判断 @bot 的消息是否为空泛指令（不包含实际技术内容） */
  private isEmptyCommand(content: string): boolean {
    if (content.length < 5) return true;
    const lower = content.toLowerCase();
    return AT_BOT_EMPTY_PATTERNS.some((p) => lower === p || lower === p + '问题');
  }

  /** 构建 @bot 场景的分析上下文（以当前消息为主，本地DB近期消息为辅） */
  private async buildAtBotContext(message: DingtalkMessageEntity): Promise<string> {
    const mainContent = `[当前@消息] ${message.sender || '未知'}: ${message.msgContent}`;

    // 尝试获取本地DB中同会话的近期@bot消息作为补充
    if (message.conversationId) {
      const recentMessages = await this.messageRepo
        .createQueryBuilder('msg')
        .where('msg.conversationId = :cid', { cid: message.conversationId })
        .andWhere('msg.id < :triggerId', { triggerId: message.id })
        .andWhere('msg.sendTime >= :timeThreshold', {
          timeThreshold: new Date(Date.now() - CONTEXT_TIME_WINDOW_MIN * 60 * 1000),
        })
        .orderBy('msg.sendTime', 'DESC')
        .take(5)
        .getMany();

      if (recentMessages.length > 0) {
        const history = recentMessages
          .reverse()
          .map((m) => `[${m.sender || '未知'}]: ${m.msgContent}`)
          .join('\n');
        return `${history}\n\n${mainContent}`;
      }
    }

    return mainContent;
  }

  /** 从 AI 结果创建文档并更新消息状态 */
  private async createDocFromResult(
    result: AutoDetectAiResult,
    message: DingtalkMessageEntity,
    categories: CategoryEntity[],
  ): Promise<DocIssueEntity | null> {
    const categoryId = await this.resolveCategoryId(result.categoryName, categories);
    const doc = this.docRepo.create({
      categoryId,
      title: result.title!,
      problem: result.problem!,
      solution: result.solution || '待补充',
      tags: result.tags || '',
      source: 2,
      status: 0,
      createUserId: SYSTEM_USER_ID,
      deleted: 0,
    });
    const saved = await this.docRepo.save(doc);
    this.eventEmitter.emit('doc.created', { docId: saved.id });

    const dbMessages = await this.gatherContextFromDb(message);
    const messageIds = dbMessages.map((m) => m.id);
    await this.messageRepo
      .createQueryBuilder()
      .update()
      .set({ handleStatus: 1, docId: saved.id })
      .whereInIds(messageIds)
      .execute();

    this.logger.log(
      `自动生成文档成功: ID=${saved.id}, 标题="${saved.title}", 分类ID=${categoryId}`,
    );
    return saved;
  }

  /** 通过钉钉 API 向群聊发送 Markdown 回复 */
  private async sendGroupReply(
    openConversationId: string,
    docInfo: { title: string; categoryName: string; tags: string } | null,
  ) {
    const cfg = await this.getConfig();
    const robotCode = cfg?.robotCode || this.config.dingtalk.robotCode;
    if (!robotCode) {
      this.logger.warn('未配置 robotCode，跳过群消息回复');
      return;
    }

    const token = await this.getDingtalkAccessToken();
    if (!token) {
      return;
    }

    const text = docInfo
      ? AT_BOT_REPLY_SUCCESS
          .replace('{{title}}', docInfo.title)
          .replace('{{categoryName}}', docInfo.categoryName)
          .replace('{{tags}}', docInfo.tags)
      : AT_BOT_REPLY_SKIP;

    try {
      const resp = await fetch(
        'https://api.dingtalk.com/v1.0/robot/groupMessages/send',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-acs-dingtalk-access-token': token,
          },
          body: JSON.stringify({
            robotCode,
            openConversationId,
            msgKey: 'sampleMarkdown',
            msgParam: JSON.stringify({
              title: '前端知识库',
              text,
            }),
          }),
        },
      );
      if (!resp.ok) {
        const errText = await resp.text();
        this.logger.warn(`群消息回复失败 ${resp.status}: ${errText}`);
      }
    } catch (err) {
      this.logger.warn('群消息回复异常', err);
    }
  }

  /** 通过钉钉 API 发送自定义 Markdown 回复 */
  private async sendGroupReplyRaw(openConversationId: string, text: string) {
    const cfg = await this.getConfig();
    const robotCode = cfg?.robotCode || this.config.dingtalk.robotCode;
    if (!robotCode) {
      this.logger.warn('未配置 robotCode，跳过群消息回复');
      return;
    }

    const token = await this.getDingtalkAccessToken();
    if (!token) return;

    try {
      const resp = await fetch(
        'https://api.dingtalk.com/v1.0/robot/groupMessages/send',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-acs-dingtalk-access-token': token,
          },
          body: JSON.stringify({
            robotCode,
            openConversationId,
            msgKey: 'sampleMarkdown',
            msgParam: JSON.stringify({ title: '前端知识库', text }),
          }),
        },
      );
      if (!resp.ok) {
        const errText = await resp.text();
        this.logger.warn(`群消息回复失败 ${resp.status}: ${errText}`);
      }
    } catch (err) {
      this.logger.warn('群消息回复异常', err);
    }
  }

  /** 检查消息内容是否命中关键词（中文直接包含匹配，英文使用词边界匹配） */
  private matchKeywords(content: string, keywords: string[]): boolean {
    const lower = content.toLowerCase();
    if (keywords.some((kw) => lower.includes(kw.toLowerCase()))) {
      return true;
    }
    return AUTO_DETECT_WORD_KEYWORDS.some((word) => {
      const re = new RegExp(`(?<![a-zA-Z])${word}(?![a-zA-Z])`, 'i');
      return re.test(content);
    });
  }

  /**
   * 聚合完整上下文文本：
   * 1. 优先通过钉钉 OpenAPI 拉取群聊最近 N 条消息
   * 2. 降级到本地 DB 已存储的消息
   */
  private async gatherContextText(
    trigger: DingtalkMessageEntity,
  ): Promise<string> {
    if (!trigger.conversationId) {
      return `[当前消息] ${trigger.sender || '未知'}: ${trigger.msgContent}`;
    }

    // 优先：通过钉钉 API 拉取群聊历史
    const apiMessages = await this.fetchChatHistoryFromApi(
      trigger.conversationId,
      CONTEXT_WINDOW_SIZE,
    );
    if (apiMessages.length > 0) {
      this.logger.log(`通过钉钉 API 拉取到 ${apiMessages.length} 条上下文消息`);
      return apiMessages
        .map((m) => {
          const time = m.createAt
            ? new Date(m.createAt).toLocaleString('zh-CN')
            : '';
          const sender = m.senderNick || '未知';
          let content = m.content || '';
          try {
            const parsed = JSON.parse(content);
            content = parsed.content || parsed.text?.content || content;
          } catch {
            // 纯文本，直接使用
          }
          return `[${time}] ${sender}: ${content}`;
        })
        .join('\n');
    }

    // 降级：使用本地DB中已采集的消息
    this.logger.log('钉钉 API 无法获取历史，降级使用本地DB消息');
    const dbMessages = await this.gatherContextFromDb(trigger);
    return this.buildContextTextFromDb(dbMessages);
  }

  /** 从本地DB聚合同一会话的消息（限制条数 + 时间窗口） */
  private async gatherContextFromDb(
    trigger: DingtalkMessageEntity,
  ): Promise<DingtalkMessageEntity[]> {
    if (!trigger.conversationId) {
      return [trigger];
    }

    const timeThreshold = new Date(
      Date.now() - CONTEXT_TIME_WINDOW_MIN * 60 * 1000,
    );

    const messages = await this.messageRepo
      .createQueryBuilder('msg')
      .where('msg.conversationId = :cid', { cid: trigger.conversationId })
      .andWhere('msg.id <= :triggerId', { triggerId: trigger.id })
      .andWhere('msg.sendTime >= :timeThreshold', { timeThreshold })
      .orderBy('msg.sendTime', 'DESC')
      .take(CONTEXT_WINDOW_SIZE)
      .getMany();

    const result = messages.reverse();
    if (!result.some((m) => m.id === trigger.id)) {
      result.push(trigger);
    }
    return result;
  }

  /** 将DB消息列表拼接为带发送人和时间的文本 */
  private buildContextTextFromDb(messages: DingtalkMessageEntity[]): string {
    return messages
      .map((m) => {
        const time = m.sendTime
          ? new Date(m.sendTime).toLocaleString('zh-CN')
          : '';
        const sender = m.sender || '未知';
        return `[${time}] ${sender}: ${m.msgContent}`;
      })
      .join('\n');
  }

  /** 获取钉钉 AccessToken（内存 + Redis 双缓存） */
  private async getDingtalkAccessToken(): Promise<string | null> {
    const cacheKey = 'dingtalk:access_token';
    const cachedRedis = await this.redis.get(cacheKey);
    if (cachedRedis) {
      return cachedRedis;
    }
    if (this.dingtalkAccessToken && Date.now() < this.dingtalkTokenExpireAt) {
      return this.dingtalkAccessToken;
    }

    const cfg = await this.getConfigEntity();
    const appSecret = cfg?.appSecret ? this.decryptAppSecret(cfg.appSecret) : '';
    if (!cfg?.appKey || !appSecret) {
      return null;
    }

    try {
      const resp = await fetch(
        'https://api.dingtalk.com/v1.0/oauth2/accessToken',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            appKey: cfg.appKey,
            appSecret,
          }),
        },
      );
      const data = (await resp.json()) as {
        accessToken?: string;
        expireIn?: number;
      };
      if (data.accessToken) {
        const ttl = Math.max(60, (data.expireIn ?? 7200) - 120);
        this.dingtalkAccessToken = data.accessToken;
        this.dingtalkTokenExpireAt = Date.now() + ttl * 1000;
        await this.redis.setex(cacheKey, ttl, data.accessToken);
        return this.dingtalkAccessToken;
      }
      this.logger.warn('获取钉钉 AccessToken 失败', data);
      return null;
    } catch (err) {
      this.logger.warn('获取钉钉 AccessToken 异常', err);
      return null;
    }
  }

  /** 通过钉钉 OpenAPI 拉取群聊历史消息 */
  private async fetchChatHistoryFromApi(
    openConversationId: string,
    maxResults: number,
  ): Promise<DingtalkApiMessage[]> {
    const token = await this.getDingtalkAccessToken();
    if (!token) {
      return [];
    }

    try {
      const resp = await fetch(
        'https://api.dingtalk.com/v1.0/im/conversations/messages/query',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-acs-dingtalk-access-token': token,
          },
          body: JSON.stringify({
            openConversationId,
            maxResults: Math.min(maxResults, 50),
            nextToken: '0',
          }),
        },
      );

      if (!resp.ok) {
        const errText = await resp.text();
        this.logger.warn(`钉钉聊天记录 API 返回 ${resp.status}: ${errText}`);
        return [];
      }

      const data = (await resp.json()) as {
        records?: DingtalkApiMessage[];
      };
      return data.records ?? [];
    } catch (err) {
      this.logger.warn('钉钉聊天记录 API 调用失败', err);
      return [];
    }
  }

  /** 获取所有有效分类名称 */
  private async getAllCategories(): Promise<CategoryEntity[]> {
    return this.categoryRepo.find({
      where: { deleted: 0 },
      order: { sort: 'ASC' },
    });
  }

  /** 调用 AI 提取文档并分类 */
  private async extractWithAutoDetect(
    contextText: string,
    categories: CategoryEntity[],
  ): Promise<AutoDetectAiResult> {
    const categoryNames = categories.map((c) => c.categoryName).join('、');
    const prompt = AUTO_DETECT_AI_PROMPT.replace('{{categories}}', categoryNames);

    const completion = await this.aiClient.chat.completions.create({
      model: this.config.ai.modelName,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: contextText },
      ],
      temperature: 0.3,
    });

    const raw = completion.choices[0]?.message?.content ?? '{}';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    try {
      const parsed = JSON.parse(
        jsonMatch ? jsonMatch[0] : raw,
      ) as AutoDetectAiResult;
      return parsed;
    } catch (err) {
      this.logger.warn(`AI 响应 JSON 解析失败: ${err}`);
      return { skip: true };
    }
  }

  /** 根据 AI 返回的分类名匹配分类ID，匹配不上则用默认分类 */
  private async resolveCategoryId(
    categoryName: string | undefined,
    categories: CategoryEntity[],
  ): Promise<number> {
    if (!categoryName) {
      return this.getDefaultCategoryId();
    }

    // 精确匹配
    const exact = categories.find((c) => c.categoryName === categoryName);
    if (exact) return exact.id;

    // 互相包含匹配
    const partial = categories.find(
      (c) =>
        c.categoryName.includes(categoryName) ||
        categoryName.includes(c.categoryName),
    );
    if (partial) return partial.id;

    // 关键词模糊匹配（去掉"相关"、"问题"等后缀再比较）
    const normalize = (s: string) =>
      s.replace(/相关|问题|类|方面/g, '').trim().toLowerCase();
    const normalizedInput = normalize(categoryName);
    const fuzzy = categories.find((c) => {
      const n = normalize(c.categoryName);
      return n.includes(normalizedInput) || normalizedInput.includes(n);
    });
    if (fuzzy) return fuzzy.id;

    // 关键词映射表：AI 可能返回的别名 → 标准分类名关键词
    const aliasMap: Record<string, string[]> = {
      '浏览器兼容': ['兼容', 'safari', 'ios', 'android', '低端机', '白屏', '机型', '适配', 'webview'],
      'CSS/样式': ['css', '样式', '布局', 'flex', 'grid', '穿透', '选择器'],
      '性能优化': ['性能', '优化', '首屏', '懒加载', '内存', '卡顿'],
      '构建工具': ['webpack', 'vite', '构建', '打包', 'hmr', '热更新', '编译'],
      'Node.js': ['node', 'npm', '依赖', '包管理'],
    };
    for (const [catKeyword, aliases] of Object.entries(aliasMap)) {
      if (aliases.some((a) => normalizedInput.includes(a))) {
        const mapped = categories.find((c) => c.categoryName.includes(catKeyword));
        if (mapped) return mapped.id;
      }
    }

    return this.getDefaultCategoryId();
  }

  /** 批量扫描：对已入库的未处理消息做关键词检测 + AI提取 */
  async batchScan() {
    const detectConfig = await this.getAutoDetectConfig();
    const keywords = (detectConfig.keywords || AUTO_DETECT_KEYWORDS.join(','))
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);

    let matched = 0;
    let generated = 0;
    let scanned = 0;
    const processedConvs = new Set<string>();
    const batchSize = 50;
    let offset = 0;

    while (true) {
      const batch = await this.messageRepo.find({
        where: { handleStatus: 0 },
        order: { sendTime: 'ASC' },
        skip: offset,
        take: batchSize,
      });
      if (batch.length === 0) {
        break;
      }
      offset += batch.length;
      scanned += batch.length;

      for (const msg of batch) {
        if (!this.matchKeywords(msg.msgContent, keywords)) {
          continue;
        }
        matched++;

        const convKey = msg.conversationId || `single_${msg.id}`;
        if (processedConvs.has(convKey)) {
          continue;
        }
        processedConvs.add(convKey);

        try {
          const contextText = await this.gatherContextText(msg);
          const categories = await this.getAllCategories();
          const result = await this.extractWithAutoDetect(contextText, categories);

          if (result.skip || !result.title || !result.problem) {
            this.logger.log(`批量扫描：AI判定无效内容，跳过会话 ${convKey}`);
            continue;
          }

          const categoryId = await this.resolveCategoryId(result.categoryName, categories);
          const doc = this.docRepo.create({
            categoryId,
            title: result.title,
            problem: result.problem,
            solution: result.solution || '待补充',
            tags: result.tags || '',
            source: 2,
            status: 0,
            createUserId: SYSTEM_USER_ID,
            deleted: 0,
          });
          const saved = await this.docRepo.save(doc);
          this.eventEmitter.emit('doc.created', { docId: saved.id });

          const dbMessages = await this.gatherContextFromDb(msg);
          const messageIds = dbMessages.map((m) => m.id);
          await this.messageRepo
            .createQueryBuilder()
            .update()
            .set({ handleStatus: 1, docId: saved.id })
            .whereInIds(messageIds)
            .execute();

          generated++;
          this.logger.log(`批量扫描生成文档: "${saved.title}", 分类ID=${categoryId}`);
        } catch (err) {
          this.logger.error(`批量扫描处理失败, 消息ID=${msg.id}`, err);
        }
      }
    }

    return { scanned, matched, generated };
  }

  /** 文档审核后钉钉通知（钉钉来源文档） */
  @OnEvent('doc.audited')
  async onDocAudited(payload: {
    docId: number;
    status: number;
    auditRemark?: string;
    title: string;
    source: number;
  }) {
    if (payload.source !== 2) {
      return;
    }
    const statusText = payload.status === 1 ? '已通过' : '已驳回';
    const remark = payload.auditRemark ? `\n备注：${payload.auditRemark}` : '';
    const messages = await this.messageRepo.find({
      where: { docId: payload.docId },
      take: 1,
    });
    const convId = messages[0]?.conversationId;
    if (!convId) {
      return;
    }
    const cfg = await this.getActiveConfig();
    const robotCode = cfg?.robotCode || this.config.dingtalk.robotCode;
    if (!robotCode) {
      return;
    }
    const token = await this.getDingtalkAccessToken();
    if (!token) {
      return;
    }
    const text = `【知识库审核】文档「${payload.title}」${statusText}${remark}`;
    try {
      await fetch('https://api.dingtalk.com/v1.0/robot/groupMessages/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-acs-dingtalk-access-token': token,
        },
        body: JSON.stringify({
          robotCode,
          openConversationId: convId,
          msgKey: 'sampleText',
          msgParam: JSON.stringify({ content: text }),
        }),
      });
    } catch (err) {
      this.logger.warn(`审核通知发送失败 docId=${payload.docId}`, err);
    }
  }

  private async getConfigEntity(): Promise<DingtalkConfigEntity | null> {
    const rows = await this.configRepo.find({ take: 1, order: { id: 'ASC' } });
    return rows[0] ?? null;
  }

  private getEncryptKey(): string {
    return process.env.DINGTALK_ENCRYPT_KEY || this.config.jwt.secret;
  }

  private decryptAppSecret(stored: string): string {
    return decryptSecret(stored, this.getEncryptKey());
  }

  /** 插入或更新系统配置 */
  private async upsertSysConfig(
    key: string,
    value: string,
    remark: string,
  ) {
    const existing = await this.sysConfigRepo.findOne({
      where: { configKey: key },
    });
    if (existing) {
      existing.configValue = value;
      await this.sysConfigRepo.save(existing);
    } else {
      await this.sysConfigRepo.save(
        this.sysConfigRepo.create({
          configKey: key,
          configValue: value,
          remark,
        }),
      );
    }
  }
}
