import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AttendanceAlarmSoundsService } from './attendance-alarm-sounds.service';

function makeId3Mp3Buffer(size = 256): Buffer {
  const buf = Buffer.alloc(size, 0x11);
  buf[0] = 0x49; // I
  buf[1] = 0x44; // D
  buf[2] = 0x33; // 3
  buf[3] = 0x03; // v2.3
  return buf;
}

function makeRawMpegFrameBuffer(size = 256): Buffer {
  const buf = Buffer.alloc(size, 0x00);
  // MPEG-1 Layer III frame sync header at offset 8
  buf[8] = 0xff;
  buf[9] = 0xfb;
  buf[10] = 0x90;
  buf[11] = 0x64;
  return buf;
}

describe('AttendanceAlarmSoundsService', () => {
  let tempRoot: string;
  let prevStorageRoot: string | undefined;
  let mockAudit: { record: ReturnType<typeof vi.fn> };
  let service: AttendanceAlarmSoundsService;

  const actor: any = {
    id: 'user-1',
    fullName: 'أدمن النظام',
  };

  beforeEach(() => {
    prevStorageRoot = process.env.STORAGE_ROOT_DIR;
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'educenter-alarms-'));
    process.env.STORAGE_ROOT_DIR = tempRoot;
    mockAudit = { record: vi.fn().mockResolvedValue(undefined) };
    service = new AttendanceAlarmSoundsService(mockAudit as never);
  });

  afterEach(() => {
    if (prevStorageRoot === undefined) {
      delete process.env.STORAGE_ROOT_DIR;
    } else {
      process.env.STORAGE_ROOT_DIR = prevStorageRoot;
    }
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('uploads a valid ID3v2 MP3, writes manifest & file, and lists it cleanly', async () => {
    const record = await service.uploadSound(
      {
        fieldname: 'file',
        originalname: 'custom-siren.mp3',
        encoding: '7bit',
        mimetype: 'audio/mpeg',
        size: 256,
        buffer: makeId3Mp3Buffer(),
      },
      'إنذار الباب الرئيسي',
      actor,
    );

    expect(record.label).toBe('إنذار الباب الرئيسي');
    expect(record.fileName).toMatch(/^alarm-[a-f0-9-]{36}\.mp3$/i);
    expect(record.url).toBe(`/api/attendance/alarm-sounds/${record.fileName}`);

    const listed = await service.listSounds();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe(record.id);

    const resolvedPath = await service.resolveSoundFilePath(record.fileName);
    expect(fs.existsSync(resolvedPath)).toBe(true);
    expect(mockAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'attendance.alarm_sound_upload',
        entityId: record.id,
      }),
    );
  });

  it('accepts raw MPEG frame-sync MP3 buffers without ID3 header', async () => {
    const record = await service.uploadSound(
      {
        fieldname: 'file',
        originalname: 'raw-beep.mp3',
        encoding: '7bit',
        mimetype: 'audio/mp3',
        size: 256,
        buffer: makeRawMpegFrameBuffer(),
      },
      undefined,
      actor,
    );

    expect(record.label).toBe('raw-beep');
    expect((await service.listSounds()).map((s) => s.id)).toContain(record.id);
  });

  it('rejects spoofed .mp3 containing non-audio HTML or text bytes', async () => {
    await expect(
      service.uploadSound(
        {
          fieldname: 'file',
          originalname: 'fake.mp3',
          encoding: '7bit',
          mimetype: 'audio/mpeg',
          size: 200,
          buffer: Buffer.from('<html><script>alert(1)</script></html>'.repeat(6)),
        },
        'ملف مزيف',
        actor,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects path traversal on resolveSoundFilePath and removes file + manifest on deleteSound', async () => {
    await expect(service.resolveSoundFilePath('../secret.mp3')).rejects.toThrow(
      BadRequestException,
    );

    const record = await service.uploadSound(
      {
        fieldname: 'file',
        originalname: 'alarm.mp3',
        encoding: '7bit',
        mimetype: 'audio/mpeg',
        size: 256,
        buffer: makeId3Mp3Buffer(),
      },
      'صوت للحذف',
      actor,
    );

    const resolvedPath = await service.resolveSoundFilePath(record.fileName);
    expect(fs.existsSync(resolvedPath)).toBe(true);

    const deleteRes = await service.deleteSound(record.id, actor);
    expect(deleteRes).toEqual({ success: true, id: record.id });
    expect(fs.existsSync(resolvedPath)).toBe(false);
    expect(await service.listSounds()).toHaveLength(0);

    await expect(service.resolveSoundFilePath(record.fileName)).rejects.toThrow(
      NotFoundException,
    );
  });
});
