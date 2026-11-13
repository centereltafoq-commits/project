import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { ExcelWorkbookService } from './excel-workbook.service';

describe('ExcelWorkbookService', () => {
  const service = new ExcelWorkbookService();

  it('normalizes Arabic-Indic digits and directional marks in phone cells', () => {
    expect(service.normalizePhoneText('٠١٠١٢٣٤٥٦٧٨\u200F ')).toBe('01012345678');
    expect(service.normalizePhoneText(1012345678)).toBe('1012345678');
  });

  it('normalizes Excel Date objects and ISO date strings without timezone shift', () => {
    const utcDate = new Date(Date.UTC(2026, 10, 13));
    expect(service.normalizeDateCell(utcDate)).toBe('2026-11-13');
    expect(service.normalizeDateCell('2026/11/5')).toBe('2026-11-05');
    expect(service.normalizeDateCell('13/11/2026')).toBe('2026-11-13');
    expect(service.normalizeDateCell('invalid-date')).toBeNull();
  });

  it('builds a styled RTL .xlsx template buffer and parses it back cleanly', async () => {
    const buffer = await service.buildWorkbookBuffer({
      sheetName: 'بيانات الطلاب',
      columns: [
        { key: 'fullName', header: 'اسم الطالب *', width: 28 },
        { key: 'phone', header: 'هاتف الطالب *', width: 18, numFmt: '@' },
        {
          key: 'status',
          header: 'الحالة',
          width: 16,
          dropdownValues: ['نشط', 'موقوف', 'مؤرشف'],
        },
      ],
      rows: [{ fullName: 'أحمد محمد', phone: '01012345678', status: 'نشط' }],
      instructionsSheet: {
        title: 'تعليمات الاستيراد',
        lines: ['املأ الحقول المطلوبة'],
      },
    });

    const parsed = await service.parseUploadedWorkbook(
      {
        fieldname: 'file',
        originalname: 'students.xlsx',
        encoding: '7bit',
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        size: buffer.length,
        buffer,
      },
      { maxRows: 2000 },
    );

    expect(parsed.headers).toEqual(['اسم الطالب *', 'هاتف الطالب *', 'الحالة']);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].rowNumber).toBe(2);
    expect(parsed.rows[0].cells['هاتف الطالب *']).toBe('01012345678');
  });

  it('rejects non-xlsx files or invalid magic bytes', async () => {
    await expect(
      service.parseUploadedWorkbook(
        {
          fieldname: 'file',
          originalname: 'bad.csv',
          encoding: '7bit',
          mimetype: 'text/csv',
          size: 10,
          buffer: Buffer.from('a,b,c\n1,2,3'),
        },
        { maxRows: 2000 },
      ),
    ).rejects.toThrow(BadRequestException);
  });
});

