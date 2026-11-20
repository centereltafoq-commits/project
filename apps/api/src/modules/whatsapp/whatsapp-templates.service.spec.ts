import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_WHATSAPP_TEMPLATES,
  WhatsappTemplatesService,
} from './whatsapp-templates.service';

describe('WhatsappTemplatesService', () => {
  let tempRoot: string;
  let prevStorageRoot: string | undefined;
  let mockAudit: { record: ReturnType<typeof vi.fn> };
  let service: WhatsappTemplatesService;

  const actor: any = {
    id: 'user-1',
    fullName: 'مدير النظام',
  };

  beforeEach(() => {
    prevStorageRoot = process.env.STORAGE_ROOT_DIR;
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'educenter-whatsapp-'));
    process.env.STORAGE_ROOT_DIR = tempRoot;
    mockAudit = { record: vi.fn().mockResolvedValue(undefined) };
    service = new WhatsappTemplatesService(mockAudit as never);
  });

  afterEach(() => {
    if (prevStorageRoot === undefined) {
      delete process.env.STORAGE_ROOT_DIR;
    } else {
      process.env.STORAGE_ROOT_DIR = prevStorageRoot;
    }
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('auto-seeds default WhatsApp templates on first listTemplates call', async () => {
    const listed = await service.listTemplates();
    expect(listed.length).toBe(DEFAULT_WHATSAPP_TEMPLATES.length);
    expect(listed[0]?.isDefault).toBe(true);
    expect(listed.some((t) => t.id === 'tpl-subscription-reminder')).toBe(true);
  });

  it('creates, updates, switches default, deletes with fallback promotion, and resets defaults', async () => {
    const created = await service.createTemplate(
      {
        title: 'تنبيه امتحان أسبوعي',
        category: 'SCHEDULE',
        content: 'السلام عليكم {اسم_الطالب}،\nموعد الامتحان غداً في {المجموعة}.',
        isDefault: true,
      },
      actor,
    );

    expect(created.isDefault).toBe(true);
    expect(created.content).toContain('\n');

    let all = await service.listTemplates();
    expect(all.filter((t) => t.isDefault)).toHaveLength(1);
    expect(all[0]?.id).toBe(created.id);

    const updated = await service.updateTemplate(
      created.id,
      { title: 'تنبيه اختبار محدث', isDefault: true },
      actor,
    );
    expect(updated.title).toBe('تنبيه اختبار محدث');

    const delRes = await service.deleteTemplate(created.id, actor);
    expect(delRes).toEqual({ success: true, id: created.id });

    all = await service.listTemplates();
    expect(all.some((t) => t.id === created.id)).toBe(false);
    expect(all.filter((t) => t.isDefault)).toHaveLength(1);

    const resetList = await service.resetDefaults(actor);
    expect(resetList).toHaveLength(DEFAULT_WHATSAPP_TEMPLATES.length);
  });

  it('throws NotFoundException or BadRequestException for unknown or invalid template IDs', async () => {
    await expect(
      service.updateTemplate('missing-tpl-id', { title: 'عنوان' }, actor),
    ).rejects.toThrow(NotFoundException);

    await expect(service.deleteTemplate('bad/id', actor)).rejects.toThrow(
      BadRequestException,
    );
  });
});
