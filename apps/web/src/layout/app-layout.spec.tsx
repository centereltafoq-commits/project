import * as React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PERMISSIONS, SystemRole } from '@edu-center/shared';
import * as authContextModule from '@/features/auth/auth-context';
import * as centerSettingsModule from '@/features/settings/center-settings-context';
import { AppLayout } from './app-layout';

vi.mock('@/features/auth/auth-context', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/features/settings/center-settings-context', () => ({
  useCenterSettings: vi.fn(),
}));

describe('AppLayout Navigation Sidebar RBAC', () => {
  const useAuthMock = vi.mocked(authContextModule.useAuth);
  const useCenterSettingsMock = vi.mocked(centerSettingsModule.useCenterSettings);

  beforeEach(() => {
    vi.clearAllMocks();
    const storage: Record<string, string> = {};
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn((key: string) => storage[key] || null),
        setItem: vi.fn((key: string, value: string) => {
          storage[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
          delete storage[key];
        }),
        clear: vi.fn(() => {
          Object.keys(storage).forEach((k) => delete storage[k]);
        }),
      },
      writable: true,
      configurable: true,
    });
    useCenterSettingsMock.mockReturnValue({
      settings: {
        id: 'default',
        centerName: 'سنتر النخبة التعليمي',
        centerSubtitle: 'نظام الإدارة',
        logoUrl: '',
        academicYear: '2026/2027',
        currencySymbol: 'ج.م',
        phone: '01000000000',
        address: 'القاهرة',
        updatedAt: '',
        updatedBy: null,
      },
      isLoading: false,
      refetch: vi.fn(),
    });
  });

  it('renders Settings nav item if user is OWNER', () => {
    useAuthMock.mockReturnValue({
      isLoading: false,
      user: {
        id: 'owner-1',
        fullName: 'المالك الرئيسي',
        email: 'owner@center.com',
        roleCode: SystemRole.OWNER,
        roleNameAr: 'مالك النظام',
        permissions: Object.values(PERMISSIONS),
      },
      logout: vi.fn(),
      hasPermission: () => true,
    } as any);

    render(
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: /إعدادات النظام/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /إعدادات النظام/i })).toHaveAttribute('href', '/settings');
  });

  it('HIDES Settings nav item if user is MANAGER even if they have SETTINGS_MANAGE permission', () => {
    useAuthMock.mockReturnValue({
      isLoading: false,
      user: {
        id: 'manager-1',
        fullName: 'المدير العام',
        email: 'manager@center.com',
        roleCode: SystemRole.MANAGER,
        roleNameAr: 'مدير النظام',
        permissions: [PERMISSIONS.SETTINGS_MANAGE, PERMISSIONS.DASHBOARD_VIEW],
      },
      logout: vi.fn(),
      hasPermission: (perm: string) =>
        perm === PERMISSIONS.SETTINGS_MANAGE || perm === PERMISSIONS.DASHBOARD_VIEW,
    } as any);

    render(
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('link', { name: /إعدادات النظام/i })).not.toBeInTheDocument();
  });

  it('HIDES Settings nav item for TEACHER or ACCOUNTANT', () => {
    useAuthMock.mockReturnValue({
      isLoading: false,
      user: {
        id: 'teacher-1',
        fullName: 'أستاذ أحمد',
        email: 'teacher@center.com',
        roleCode: SystemRole.TEACHER,
        roleNameAr: 'مدرس',
        permissions: [PERMISSIONS.CALENDAR_VIEW],
      },
      logout: vi.fn(),
      hasPermission: (perm: string) => perm === PERMISSIONS.CALENDAR_VIEW,
    } as any);

    render(
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('link', { name: /إعدادات النظام/i })).not.toBeInTheDocument();
  });

  it('toggles sidebar collapse state and persists to localStorage', () => {
    useAuthMock.mockReturnValue({
      isLoading: false,
      user: {
        id: 'owner-1',
        fullName: 'المالك الرئيسي',
        email: 'owner@center.com',
        roleCode: SystemRole.OWNER,
        roleNameAr: 'مالك النظام',
        permissions: Object.values(PERMISSIONS),
      },
      logout: vi.fn(),
      hasPermission: () => true,
    } as any);

    render(
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>,
    );

    const sidebar = screen.getByTestId('app-sidebar');
    expect(sidebar.className).toContain('w-72');
    expect(sidebar.className).not.toContain('lg:w-20');

    const toggleBtn = screen.getByTestId('sidebar-toggle-btn');
    expect(toggleBtn).toBeInTheDocument();

    fireEvent.click(toggleBtn);

    expect(sidebar.className).toContain('lg:w-20');
    expect(window.localStorage.getItem('edu_sidebar_collapsed')).toBe('true');

    // Click again to expand via header toggle button
    const headerToggleBtn = screen.getByTestId('header-sidebar-toggle-btn');
    expect(headerToggleBtn).toBeInTheDocument();
    fireEvent.click(headerToggleBtn);
    expect(sidebar.className).not.toContain('lg:w-20');
    expect(window.localStorage.getItem('edu_sidebar_collapsed')).toBe('false');

    // Also test expanding via sidebar mini-logo button
    const toggleAgainBtn = screen.getByTestId('sidebar-toggle-btn');
    fireEvent.click(toggleAgainBtn);
    expect(sidebar.className).toContain('lg:w-20');

    const logoExpandBtn = screen.getByTestId('sidebar-logo-expand-btn');
    expect(logoExpandBtn).toBeInTheDocument();
    fireEvent.click(logoExpandBtn);
    expect(sidebar.className).not.toContain('lg:w-20');
    expect(window.localStorage.getItem('edu_sidebar_collapsed')).toBe('false');
  });

  it('restores collapsed state from localStorage on initial render', () => {
    window.localStorage.setItem('edu_sidebar_collapsed', 'true');

    useAuthMock.mockReturnValue({
      isLoading: false,
      user: {
        id: 'owner-1',
        fullName: 'المالك الرئيسي',
        email: 'owner@center.com',
        roleCode: SystemRole.OWNER,
        roleNameAr: 'مالك النظام',
        permissions: Object.values(PERMISSIONS),
      },
      logout: vi.fn(),
      hasPermission: () => true,
    } as any);

    render(
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>,
    );

    const sidebar = screen.getByTestId('app-sidebar');
    expect(sidebar.className).toContain('lg:w-20');
  });

  it('renders creator branding badge and docs link in top header', () => {
    useAuthMock.mockReturnValue({
      isLoading: false,
      user: {
        id: 'user-1',
        fullName: 'الموظف المسؤول',
        email: 'staff@center.com',
        roleCode: SystemRole.ACCOUNTANT,
        roleNameAr: 'سكرتارية واستقبال',
        permissions: [PERMISSIONS.DASHBOARD_VIEW],
      },
      logout: vi.fn(),
      hasPermission: () => true,
    } as any);

    render(
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>,
    );

    expect(screen.getByText('تم الإنشاء بواسطة')).toBeInTheDocument();
    expect(screen.getByText('nazzem edu')).toBeInTheDocument();

    const docsBtn = screen.getByTestId('header-docs-btn');
    expect(docsBtn).toBeInTheDocument();
    expect(docsBtn).toHaveAttribute('href', '/docs');
  });
});
