import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import {
  CreateWhatsappTemplateDto,
  UpdateWhatsappTemplateDto,
  WHATSAPP_TEMPLATE_CATEGORIES,
  WhatsappTemplateCategory,
} from './dto/whatsapp-template.dto';

export interface WhatsappTemplateRecord {
  id: string;
  title: string;
  category: WhatsappTemplateCategory;
  content: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

const MAX_TEMPLATES = 50;
const TEMPLATES_FILENAME = 'templates.json';
const VALID_TEMPLATE_ID_REGEX = /^[a-zA-Z0-9_-]{3,64}$/;

const SEED_TIMESTAMP = '2026-11-01T10:00:00.000Z';

export const DEFAULT_WHATSAPP_TEMPLATES: ReadonlyArray<WhatsappTemplateRecord> = [
  {
    id: 'tpl-subscription-reminder',
    title: 'تذكير بسداد الاشتراك الشهري',
    category: 'SUBSCRIPTION',
    content:
      'السلام عليكم ولي أمر الطالب {اسم_الطالب}،\nنذكّر سيادتكم بموعد سداد اشتراك مجموعة ({المجموعة}) - مادة {المادة} للصف {الصف_الدراسي}.\nمع تحيات إدارة {اسم_السنتر}.',
    isDefault: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
  {
    id: 'tpl-absence-notice',
    title: 'إشعار غياب الطالب عن الحصة',
    category: 'ABSENCE',
    content:
      'السلام عليكم ولي أمر الطالب {اسم_الطالب}،\nنحيطكم علماً بتغيّب الطالب عن حصة اليوم ({التاريخ}) في مجموعة ({المجموعة}) - {المادة} مع {المدرس}.\nيرجى المتابعة مع إدارة {اسم_السنتر}.',
    isDefault: false,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
  {
    id: 'tpl-attendance-confirm',
    title: 'تأكيد حضور الحصة',
    category: 'ATTENDANCE',
    content:
      'السلام عليكم ولي أمر الطالب {اسم_الطالب}،\nتم تسجيل حضور الطالب بنجاح في حصة {المادة} ({المجموعة}) بتاريخ {التاريخ}.\nمع تحيات {اسم_السنتر}.',
    isDefault: false,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
  {
    id: 'tpl-schedule-change',
    title: 'تنويه بتعديل موعد المجموعة',
    category: 'SCHEDULE',
    content:
      'السلام عليكم، تنويه هام لطلاب مجموعة ({المجموعة}) - مادة {المادة}:\nيرجى التواصل أو الحضور لمراجعة الموعد المحدّث للحصة مع {المدرس}.\nإدارة {اسم_السنتر}.',
    isDefault: false,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
  {
    id: 'tpl-general-greeting',
    title: 'رسالة ترحيب ومتابعة عامة',
    category: 'GENERAL',
    content:
      'السلام عليكم {اسم_الطالب}،\nيسعدنا تواصلكم مع إدارة {اسم_السنتر}. يمكنكم الرد على هذه الرسالة لأي استفسار بخصوص مجموعة ({المجموعة}).',
    isDefault: false,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
];

function sanitizeSingleLineText(value: string, maxLen: number): string {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function sanitizeMultilineContent(value: string, maxLen: number): string {
  return value
    .replace(/\r\n/g, '\n')
    // Strip control chars except newline (\n) and tab (\t)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .trim()
    .slice(0, maxLen);
}

function buildDefaultTemplatesCopy(): WhatsappTemplateRecord[] {
  return DEFAULT_WHATSAPP_TEMPLATES.map((tpl) => ({ ...tpl }));
}

@Injectable()
export class WhatsappTemplatesService {
  private readonly logger = new Logger(WhatsappTemplatesService.name);
  private writeQueue: Promise<unknown> = Promise.resolve();

  constructor(@Optional() private readonly auditLogsService?: AuditLogsService) {}

  getStorageDir(): string {
    const storageRoot = process.env.STORAGE_ROOT_DIR || process.cwd();
    return path.resolve(storageRoot, 'storage', 'uploads', 'whatsapp');
  }

  private getTemplatesFilePath(dir: string): string {
    return path.join(dir, TEMPLATES_FILENAME);
  }

  private async ensureStorageDir(): Promise<string> {
    const dir = this.getStorageDir();
    await fs.promises.mkdir(dir, { recursive: true });
    return dir;
  }

  private runSerialized<T>(task: () => Promise<T>): Promise<T> {
    const next = this.writeQueue.then(task, task);
    this.writeQueue = next.catch(() => undefined);
    return next;
  }

  private async writeTemplatesAtomic(
    dir: string,
    records: WhatsappTemplateRecord[],
  ): Promise<void> {
    const filePath = this.getTemplatesFilePath(dir);
    const tmpPath = path.join(dir, `${TEMPLATES_FILENAME}.${crypto.randomUUID()}.tmp`);
    await fs.promises.writeFile(tmpPath, JSON.stringify(records, null, 2), 'utf-8');
    await fs.promises.rename(tmpPath, filePath);
  }

  private async readOrSeedTemplates(dir: string): Promise<WhatsappTemplateRecord[]> {
    const filePath = this.getTemplatesFilePath(dir);
    try {
      const raw = await fs.promises.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (item): item is WhatsappTemplateRecord =>
            Boolean(item) &&
            typeof item.id === 'string' &&
            typeof item.title === 'string' &&
            typeof item.content === 'string',
        );
      }
    } catch (err: any) {
      if (err?.code !== 'ENOENT') {
        this.logger.warn(`Failed reading WhatsApp templates file: ${err?.message ?? err}`);
      }
    }

    const seeded = buildDefaultTemplatesCopy();
    await this.writeTemplatesAtomic(dir, seeded);
    return seeded;
  }

  private assertValidId(id: string): void {
    if (!id || !VALID_TEMPLATE_ID_REGEX.test(id)) {
      throw new BadRequestException('معرف القالب غير صالح');
    }
  }

  async listTemplates(): Promise<WhatsappTemplateRecord[]> {
    const dir = await this.ensureStorageDir();
    const templates = await this.runSerialized(() => this.readOrSeedTemplates(dir));
    return [...templates].sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
  }

  async createTemplate(
    dto: CreateWhatsappTemplateDto,
    actor?: AuthenticatedUser,
  ): Promise<WhatsappTemplateRecord> {
    const title = sanitizeSingleLineText(dto.title, 80);
    const content = sanitizeMultilineContent(dto.content, 2000);
    if (title.length < 2) {
      throw new BadRequestException('عنوان القالب يجب ألا يقل عن حرفين');
    }
    if (content.length < 2) {
      throw new BadRequestException('نص الرسالة يجب ألا يقل عن حرفين');
    }

    const category: WhatsappTemplateCategory =
      dto.category && WHATSAPP_TEMPLATE_CATEGORIES.includes(dto.category)
        ? dto.category
        : 'GENERAL';

    const dir = await this.ensureStorageDir();
    const now = new Date().toISOString();

    const created = await this.runSerialized(async () => {
      const existing = await this.readOrSeedTemplates(dir);
      if (existing.length >= MAX_TEMPLATES) {
        throw new BadRequestException(
          `تم الوصول للحد الأقصى (${MAX_TEMPLATES} قالب)، يرجى حذف أحد القوالب القديمة أولاً`,
        );
      }

      const makeDefault = Boolean(dto.isDefault) || existing.length === 0;
      const record: WhatsappTemplateRecord = {
        id: `tpl-${crypto.randomUUID()}`,
        title,
        category,
        content,
        isDefault: makeDefault,
        createdAt: now,
        updatedAt: now,
      };

      const nextList = makeDefault
        ? existing.map((t) => ({ ...t, isDefault: false }))
        : existing;

      await this.writeTemplatesAtomic(dir, [record, ...nextList]);
      return record;
    });

    await this.auditLogsService?.record({
      actorUserId: actor?.id,
      actorName: actor?.fullName,
      action: 'whatsapp.template_create',
      entityType: 'WHATSAPP_TEMPLATE',
      entityId: created.id,
      afterData: created,
    });

    return created;
  }

  async updateTemplate(
    id: string,
    dto: UpdateWhatsappTemplateDto,
    actor?: AuthenticatedUser,
  ): Promise<WhatsappTemplateRecord> {
    this.assertValidId(id);
    const dir = await this.ensureStorageDir();

    const { before, after } = await this.runSerialized(async () => {
      const existing = await this.readOrSeedTemplates(dir);
      const idx = existing.findIndex((t) => t.id === id);
      if (idx === -1) {
        throw new NotFoundException('قالب الرسالة غير موجود');
      }

      const current = existing[idx]!;
      const nextTitle =
        dto.title !== undefined ? sanitizeSingleLineText(dto.title, 80) : current.title;
      const nextContent =
        dto.content !== undefined
          ? sanitizeMultilineContent(dto.content, 2000)
          : current.content;

      if (nextTitle.length < 2) {
        throw new BadRequestException('عنوان القالب يجب ألا يقل عن حرفين');
      }
      if (nextContent.length < 2) {
        throw new BadRequestException('نص الرسالة يجب ألا يقل عن حرفين');
      }

      const nextCategory =
        dto.category && WHATSAPP_TEMPLATE_CATEGORIES.includes(dto.category)
          ? dto.category
          : current.category;

      const updated: WhatsappTemplateRecord = {
        ...current,
        title: nextTitle,
        category: nextCategory,
        content: nextContent,
        isDefault: dto.isDefault !== undefined ? Boolean(dto.isDefault) : current.isDefault,
        updatedAt: new Date().toISOString(),
      };

      let nextList = existing.map((item, i) => {
        if (i === idx) return updated;
        return updated.isDefault ? { ...item, isDefault: false } : item;
      });

      // Ensure at least one template stays default if the current default was unchecked
      if (!nextList.some((item) => item.isDefault) && nextList.length > 0) {
        nextList = nextList.map((item, i) =>
          i === idx ? { ...item, isDefault: true } : item,
        );
        updated.isDefault = true;
      }

      await this.writeTemplatesAtomic(dir, nextList);
      return { before: current, after: updated };
    });

    await this.auditLogsService?.record({
      actorUserId: actor?.id,
      actorName: actor?.fullName,
      action: 'whatsapp.template_update',
      entityType: 'WHATSAPP_TEMPLATE',
      entityId: id,
      beforeData: before,
      afterData: after,
    });

    return after;
  }

  async deleteTemplate(
    id: string,
    actor?: AuthenticatedUser,
  ): Promise<{ success: true; id: string }> {
    this.assertValidId(id);
    const dir = await this.ensureStorageDir();

    const deleted = await this.runSerialized(async () => {
      const existing = await this.readOrSeedTemplates(dir);
      const target = existing.find((t) => t.id === id);
      if (!target) {
        throw new NotFoundException('قالب الرسالة غير موجود');
      }

      const remaining = existing.filter((t) => t.id !== id);
      if (remaining.length > 0 && !remaining.some((t) => t.isDefault)) {
        remaining[0] = { ...remaining[0]!, isDefault: true };
      }

      await this.writeTemplatesAtomic(dir, remaining);
      return target;
    });

    await this.auditLogsService?.record({
      actorUserId: actor?.id,
      actorName: actor?.fullName,
      action: 'whatsapp.template_delete',
      entityType: 'WHATSAPP_TEMPLATE',
      entityId: id,
      beforeData: deleted,
    });

    return { success: true, id };
  }

  async resetDefaults(actor?: AuthenticatedUser): Promise<WhatsappTemplateRecord[]> {
    const dir = await this.ensureStorageDir();
    const seeded = buildDefaultTemplatesCopy();

    await this.runSerialized(async () => {
      await this.writeTemplatesAtomic(dir, seeded);
    });

    await this.auditLogsService?.record({
      actorUserId: actor?.id,
      actorName: actor?.fullName,
      action: 'whatsapp.template_reset_defaults',
      entityType: 'WHATSAPP_TEMPLATE',
      entityId: 'defaults',
      afterData: { count: seeded.length },
    });

    return seeded;
  }
}
