import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { SystemRole } from '@edu-center/shared';
import { apiClient, getAccessToken, setAccessToken } from '@/lib/api-client';

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  phone?: string | null;
  roleCode: string;
  roleNameAr: string;
  permissions: string[];
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (perm: string) => boolean;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setIsLoading(false);
      return;
    }
    apiClient
      .get<AuthUser>('/auth/me')
      .then((res) => setUser(res.data))
      .catch(() => {
        setAccessToken(null);
        setUser(null);
        queryClient.clear();
      })
      .finally(() => setIsLoading(false));
  }, [queryClient]);

  const login = React.useCallback(async (email: string, password: string) => {
    queryClient.clear();
    const res = await apiClient.post<{ accessToken: string; user: AuthUser }>('/auth/login', {
      email,
      password,
    });
    setAccessToken(res.data.accessToken);
    setUser(res.data.user);
  }, [queryClient]);

  const logout = React.useCallback(async () => {
    await apiClient.post('/auth/logout').catch(() => undefined);
    setAccessToken(null);
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  const hasPermission = React.useCallback(
    (perm: string): boolean => {
      if (!user) return false;
      if (user.roleCode === SystemRole.OWNER) return true;
      return user.permissions.includes(perm);
    },
    [user],
  );

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}

