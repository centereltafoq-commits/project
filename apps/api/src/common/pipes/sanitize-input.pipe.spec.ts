import { describe, expect, it } from 'vitest';
import { SanitizeInputPipe } from './sanitize-input.pipe';

describe('SanitizeInputPipe (XSS & Prototype Pollution Defense)', () => {
  const pipe = new SanitizeInputPipe();

  it('strips script tags and inline event handlers', () => {
    const dirty = {
      fullName: '  أحمد محمد <script>alert("xss")</script>  ',
      notes: 'ملاحظة <iframe src="evil"></iframe> javascript:alert(1)',
    };
    const cleaned = pipe.transform(dirty, { type: 'body' }) as Record<string, string>;
    expect(cleaned.fullName).toBe('أحمد محمد');
    expect(cleaned.notes).not.toContain('<iframe');
    expect(cleaned.notes).not.toContain('javascript:');
  });
});

