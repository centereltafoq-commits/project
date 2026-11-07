import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

let accessTokenMemory: string | null = localStorage.getItem('edu_access_token');

export function setAccessToken(token: string | null): void {
  accessTokenMemory = token;
  if (token) {
    localStorage.setItem('edu_access_token', token);
  } else {
    localStorage.removeItem('edu_access_token');
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
      !original.url?.includes('/auth/refresh')
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

export function extractErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const msg = err.response?.data?.message;
    if (typeof msg === 'string') return msg;
    if (Array.isArray(msg)) return msg[0];
  }
  if (err instanceof Error) return err.message;
  return 'حدث خطأ غير متوقع، يرجى المحاولة مرة أخرى';
}

