import { describe, expect, it, vi } from 'vitest';
import { generateStudentsQrPdf } from './student-qr-pdf.generator';

vi.mock('../qr-code.util', () => ({
  buildStudentQrPayload: (code: string) => `EDU:${code}`,
  generateQrDataUrl: vi.fn().mockResolvedValue('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='),
}));

describe('generateStudentsQrPdf', () => {
  it('generates multi-page A4 PDF cleanly with English header and requested grid density', async () => {
    const sampleStudents = Array.from({ length: 21 }, (_, idx) => ({
      id: `stu-${idx + 1}`,
      studentCode: `STU-2026-${5001 + idx}`,
      fullName: `Student Name ${idx + 1}`,
      gradeLevel: '1st Prep',
    }));

    const result = await generateStudentsQrPdf({
      students: sampleStudents,
      preset: 'compact-20',
      autoDownload: false,
      filename: 'test-qr-sheet.pdf',
    });

    expect(result.totalPages).toBe(2);
    expect(result.fileName).toBe('test-qr-sheet.pdf');
    expect(result.doc.getNumberOfPages()).toBe(2);

    const singlePageMedium = await generateStudentsQrPdf({
      students: sampleStudents.slice(0, 12),
      preset: 'medium-12',
      autoDownload: false,
    });
    expect(singlePageMedium.totalPages).toBe(1);
    expect(singlePageMedium.doc.getNumberOfPages()).toBe(1);
  });

  it('throws a clear error when student list is empty', async () => {
    await expect(
      generateStudentsQrPdf({
        students: [],
        autoDownload: false,
      }),
    ).rejects.toThrow(/No students selected/i);
  });
});
