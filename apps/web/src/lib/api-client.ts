import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

let accessTokenMemory: string | null =
  typeof window !== 'undefined' && window.localStorage
    ? window.localStorage.getItem('edu_access_token')
    : null;

export function setAccessToken(token: string | null): void {
  accessTokenMemory = token;
  if (typeof window !== 'undefined' && window.localStorage) {
    if (token) {
      window.localStorage.setItem('edu_access_token', token);
    } else {
      window.localStorage.removeItem('edu_access_token');
    }
  }
}

export function getAccessToken(): string | null {
  return accessTokenMemory;
}

export const apiClient = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessTokenMemory && config.headers) {
    config.headers.Authorization = `Bearer ${accessTokenMemory}`;
  }
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

apiClient.interceptors.response.use(
  (res) => res,
  async (error: AxiosError<{ message?: string }>) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    if (
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      !original.url?.includes('/auth/login') &&
      !original.url?.includes('/auth/refresh') &&
      !original.url?.includes('/settings/reset-academic-year') &&
      !original.url?.includes('/backups/restore')
    ) {
      original._retry = true;
      if (!refreshPromise) {
        refreshPromise = axios
          .post<{ accessToken: string }>('/api/auth/refresh', {}, { withCredentials: true })
          .then((res) => {
            setAccessToken(res.data.accessToken);
            return res.data.accessToken;
          })
          .catch(() => {
            setAccessToken(null);
            return null;
          })
          .finally(() => {
            refreshPromise = null;
          });
      }
      const newToken = await refreshPromise;
      if (newToken && original.headers) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(original);
      }
    }
    return Promise.reject(error);
  },
);

export function extractErrorMessage(
  err: unknown,
  fallback = 'حدث خطأ غير متوقع، يرجى المحاولة مرة أخرى',
): string {
  if (axios.isAxiosError(err)) {
    if (!err.response) {
      return 'تعذر الاتصال بالخادم، يرجى التأكد من تشغيل الخادم واتصالك بالشبكة';
    }
    const status = err.response.status;
    const msg = err.response.data?.message;
    if (Array.isArray(msg) && msg[0]) return String(msg[0]);
    if (typeof msg === 'string' && msg.trim().length > 0) {
      if (status === 429 || /throttler|too many requests/i.test(msg)) {
        return 'تم تجاوز الحد المسموح من المحاولات، يرجى الانتظار دقيقة ثم المحاولة مرة أخرى';
      }
      return msg;
    }
    if (status === 429) {
      return 'تم تجاوز الحد المسموح من المحاولات، يرجى الانتظار دقيقة ثم المحاولة مرة أخرى';
    }
    if (status === 401) {
      return 'بيانات الدخول غير صحيحة أو انتهت صلاحية الجلسة';
    }
    if (status === 403) {
      return 'ليس لديك صلاحية لتنفيذ هذا الإجراء';
    }
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

