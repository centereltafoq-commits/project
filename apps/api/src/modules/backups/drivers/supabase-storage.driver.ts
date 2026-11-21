import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { CloudSyncManifest } from '../cloud-sync.types';

export interface SupabaseStorageCredentials {
  supabaseUrl: string;
  supabaseKey: string;
  bucketName: string;
}

const REQUEST_TIMEOUT_MS = 30000;
const BUCKET_NAME_REGEX = /^[a-z0-9][a-z0-9-_]{1,61}[a-z0-9]$/;

@Injectable()
export class SupabaseStorageDriver {
  private readonly logger = new Logger(SupabaseStorageDriver.name);

  normalizeSupabaseUrl(rawUrl: string): string {
    const trimmed = (rawUrl || '').trim();
    if (!trimmed) {
      throw new BadRequestException('رابط مشروع Supabase مطلوب');
    }

    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      throw new BadRequestException(
        'رابط مشروع Supabase غير صالح. يجب أن يكون بالشكل التالي: https://xxxx.supabase.co',
      );
    }

    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new BadRequestException('رابط Supabase يجب أن يبدأ بـ https:// أو http://');
    }

    const cleanedPath = parsed.pathname
      .replace(/\/+$/, '')
      .replace(/\/(storage|rest|auth)\/v1.*$/i, '');

    return `${parsed.origin}${cleanedPath}`.replace(/\/+$/, '');
  }

  validateBucketName(bucketName: string): string {
    const clean = (bucketName || 'educenter-sync').trim().toLowerCase();
    if (!BUCKET_NAME_REGEX.test(clean)) {
      throw new BadRequestException(
        'اسم الحاوية (Bucket) غير صالح. يُسمح فقط بالأحرف الإنجليزية الصغيرة والأرقام والشرطة (-)',
      );
    }
    return clean;
  }

  private buildHeaders(
    supabaseKey: string,
    extra?: Record<string, string>,
  ): Record<string, string> {
    return {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      ...(extra || {}),
    };
  }

  private encodeObjectPath(objectPath: string): string {
    const segments = objectPath
      .split('/')
      .map((s) => s.trim())
      .filter(Boolean);
    if (segments.length === 0 || segments.some((s) => s === '.' || s === '..')) {
      throw new BadRequestException('مسار الملف السحابي غير صالح');
    }
    return segments.map((s) => encodeURIComponent(s)).join('/');
  }

  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      return await fetch(url, {
        ...init,
        signal: controller.signal,
      });
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        throw new Error('انتهت مهلة الاتصال بسيرفر Supabase (تأكد من اتصال الإنترنت)');
      }
      throw new Error(
        `تعذر الاتصال بسيرفر Supabase: ${err?.message || 'خطأ في الشبكة'}`,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  private async readErrorText(response: Response): Promise<string> {
    try {
      const text = await response.text();
      if (!text) return `HTTP ${response.status}`;
      try {
        const json = JSON.parse(text) as { message?: string; error?: string };
        return json.message || json.error || text;
      } catch {
        return text.slice(0, 300);
      }
    } catch {
      return `HTTP ${response.status}`;
    }
  }

  private isNotFoundPayload(status: number, bodyText: string): boolean {
    if (status === 404) return true;
    if (status === 400 || status === 404) {
      return /not[_\s-]?found|does not exist|no such|empty/i.test(bodyText);
    }
    return false;
  }

  async ensureBucket(
    creds: SupabaseStorageCredentials,
  ): Promise<{ ok: boolean; bucketCreated: boolean; error?: string }> {
    const baseUrl = this.normalizeSupabaseUrl(creds.supabaseUrl);
    const bucketName = this.validateBucketName(creds.bucketName);
    const key = (creds.supabaseKey || '').trim();

    if (!key) {
      return {
        ok: false,
        bucketCreated: false,
        error: 'مفتاح الصلاحية (Supabase Key) مطلوب للاتصال',
      };
    }

    try {
      const checkRes = await this.fetchWithTimeout(
        `${baseUrl}/storage/v1/bucket/${encodeURIComponent(bucketName)}`,
        {
          method: 'GET',
          headers: this.buildHeaders(key),
        },
      );

      if (checkRes.ok) {
        return { ok: true, bucketCreated: false };
      }

      const checkErr = await this.readErrorText(checkRes);

      if (this.isNotFoundPayload(checkRes.status, checkErr)) {
        const createRes = await this.fetchWithTimeout(`${baseUrl}/storage/v1/bucket`, {
          method: 'POST',
          headers: this.buildHeaders(key, { 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            id: bucketName,
            name: bucketName,
            public: false,
          }),
        });

        if (createRes.ok) {
          this.logger.log(`Created private Supabase Storage bucket "${bucketName}"`);
          return { ok: true, bucketCreated: true };
        }

        const createErr = await this.readErrorText(createRes);
        if (createRes.status === 409 || /already exists/i.test(createErr)) {
          return { ok: true, bucketCreated: false };
        }

        if (createRes.status === 401 || createRes.status === 403) {
          // Fallback probe in case bucket already exists under restricted anon RLS
          const listRes = await this.fetchWithTimeout(
            `${baseUrl}/storage/v1/object/list/${encodeURIComponent(bucketName)}`,
            {
              method: 'POST',
              headers: this.buildHeaders(key, { 'Content-Type': 'application/json' }),
              body: JSON.stringify({ prefix: '', limit: 1 }),
            },
          );
          if (listRes.ok) {
            return { ok: true, bucketCreated: false };
          }
          return {
            ok: false,
            bucketCreated: false,
            error:
              'مفتاح Supabase المستخدم لا يملك صلاحية إنشاء أو إدارة التخزين. يُرجى نسخ مفتاح service_role من إعدادات المشروع في Supabase (Project Settings -> API) لضمان أعلى أمان وخصوصية للبيانات.',
          };
        }

        return {
          ok: false,
          bucketCreated: false,
          error: `تعذر إنشاء حاوية التخزين (${bucketName}): ${createErr}`,
        };
      }

      if (checkRes.status === 401 || checkRes.status === 403) {
        const listRes = await this.fetchWithTimeout(
          `${baseUrl}/storage/v1/object/list/${encodeURIComponent(bucketName)}`,
          {
            method: 'POST',
            headers: this.buildHeaders(key, { 'Content-Type': 'application/json' }),
            body: JSON.stringify({ prefix: '', limit: 1 }),
          },
        );
        if (listRes.ok) {
          return { ok: true, bucketCreated: false };
        }
        return {
          ok: false,
          bucketCreated: false,
          error:
            'فشل التحقق من مفتاح Supabase. تأكد من إدخال مفتاح service_role الصحيح من صفحة (Project Settings -> API).',
        };
      }

      return {
        ok: false,
        bucketCreated: false,
        error: `خطأ من Supabase أثناء فحص التخزين: ${checkErr}`,
      };
    } catch (err: any) {
      return {
        ok: false,
        bucketCreated: false,
        error: err?.message || 'تعذر الاتصال بسيرفر Supabase',
      };
    }
  }

  async getManifest(
    creds: SupabaseStorageCredentials,
  ): Promise<CloudSyncManifest | null> {
    const baseUrl = this.normalizeSupabaseUrl(creds.supabaseUrl);
    const bucketName = this.validateBucketName(creds.bucketName);
    const url = `${baseUrl}/storage/v1/object/${encodeURIComponent(bucketName)}/manifest.json?t=${Date.now()}`;

    const res = await this.fetchWithTimeout(url, {
      method: 'GET',
      headers: this.buildHeaders(creds.supabaseKey, {
        'Cache-Control': 'no-cache',
      }),
    });

    if (res.ok) {
      const text = await res.text();
      if (!text.trim()) return null;
      const parsed = JSON.parse(text) as CloudSyncManifest;
      if (!parsed || !parsed.latest || typeof parsed.latest.version !== 'number') {
        throw new Error('ملف فهرس المزامنة السحابي (manifest.json) غير مكتمل أو تالف');
      }
      return parsed;
    }

    const errText = await this.readErrorText(res);
    if (this.isNotFoundPayload(res.status, errText)) {
      return null;
    }

    if (res.status === 401 || res.status === 403) {
      throw new Error(
        'مفتاح Supabase غير مخوّل لقراءة ملفات المزامنة. تأكد من استخدام مفتاح service_role الصحيح.',
      );
    }

    throw new Error(`تعذر قراءة حالة السحابة من Supabase: ${errText}`);
  }

  async uploadSnapshot(
    creds: SupabaseStorageCredentials,
    objectPath: string,
    gzBuffer: Buffer,
  ): Promise<void> {
    const baseUrl = this.normalizeSupabaseUrl(creds.supabaseUrl);
    const bucketName = this.validateBucketName(creds.bucketName);
    const encodedPath = this.encodeObjectPath(objectPath);
    const url = `${baseUrl}/storage/v1/object/${encodeURIComponent(bucketName)}/${encodedPath}`;

    const res = await this.fetchWithTimeout(url, {
      method: 'POST',
      headers: this.buildHeaders(creds.supabaseKey, {
        'Content-Type': 'application/gzip',
        'x-upsert': 'true',
      }),
      body: new Uint8Array(gzBuffer),
    });

    if (!res.ok) {
      const errText = await this.readErrorText(res);
      throw new Error(`فشل رفع نسخة قاعدة البيانات إلى Supabase: ${errText}`);
    }
  }

  async uploadManifest(
    creds: SupabaseStorageCredentials,
    manifest: CloudSyncManifest,
  ): Promise<void> {
    const baseUrl = this.normalizeSupabaseUrl(creds.supabaseUrl);
    const bucketName = this.validateBucketName(creds.bucketName);
    const url = `${baseUrl}/storage/v1/object/${encodeURIComponent(bucketName)}/manifest.json`;

    const res = await this.fetchWithTimeout(url, {
      method: 'POST',
      headers: this.buildHeaders(creds.supabaseKey, {
        'Content-Type': 'application/json',
        'x-upsert': 'true',
        'Cache-Control': 'no-cache',
      }),
      body: JSON.stringify(manifest, null, 2),
    });

    if (!res.ok) {
      const errText = await this.readErrorText(res);
      throw new Error(`فشل تحديث فهرس المزامنة على Supabase: ${errText}`);
    }
  }

  async downloadSnapshot(
    creds: SupabaseStorageCredentials,
    objectPath: string,
  ): Promise<Buffer> {
    const baseUrl = this.normalizeSupabaseUrl(creds.supabaseUrl);
    const bucketName = this.validateBucketName(creds.bucketName);
    const encodedPath = this.encodeObjectPath(objectPath);
    const url = `${baseUrl}/storage/v1/object/${encodeURIComponent(bucketName)}/${encodedPath}?t=${Date.now()}`;

    const res = await this.fetchWithTimeout(url, {
      method: 'GET',
      headers: this.buildHeaders(creds.supabaseKey, {
        'Cache-Control': 'no-cache',
      }),
    });

    if (!res.ok) {
      const errText = await this.readErrorText(res);
      throw new Error(`فشل تنزيل النسخة السحابية من Supabase: ${errText}`);
    }

    const arrayBuf = await res.arrayBuffer();
    return Buffer.from(arrayBuf);
  }

  async deleteObjects(
    creds: SupabaseStorageCredentials,
    prefixes: string[],
  ): Promise<void> {
    if (!prefixes || prefixes.length === 0) return;
    try {
      const baseUrl = this.normalizeSupabaseUrl(creds.supabaseUrl);
      const bucketName = this.validateBucketName(creds.bucketName);
      const url = `${baseUrl}/storage/v1/object/${encodeURIComponent(bucketName)}`;

      const res = await this.fetchWithTimeout(url, {
        method: 'DELETE',
        headers: this.buildHeaders(creds.supabaseKey, {
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ prefixes }),
      });

      if (!res.ok) {
        const errText = await this.readErrorText(res);
        this.logger.warn(`Non-fatal failure cleaning old cloud snapshots: ${errText}`);
      }
    } catch (err: any) {
      this.logger.warn(`Non-fatal failure cleaning old cloud snapshots: ${err?.message}`);
    }
  }
}
