import * as React from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import {
  BookOpen,
  CloudDownload,
  GraduationCap,
  Loader2,
  LogOut,
  Menu,
  Moon,
  PanelRightClose,
  PanelRightOpen,
  RotateCw,
  Sun,
  X,
} from 'lucide-react';
import { SystemRole } from '@edu-center/shared';
import { Badge, Button } from '@/design-system';
import { cn } from '@/lib/cn';
import { useAuth } from '@/features/auth/auth-context';
import { useCenterSettings } from '@/features/settings/center-settings-context';
import { useDesktop } from '@/hooks/use-desktop';
import { DesktopUpdateModal } from '@/components/desktop-update-panel';
import { ErrorBoundary } from '@/components/error-boundary';
import { HeaderCloudSyncButton } from '@/components/header-cloud-sync-button';
import { SIDEBAR_NAV_ITEMS } from './nav-items';

export function AppLayout() {
  const location = useLocation();
  const { user, isLoading, logout, hasPermission } = useAuth();
  const { settings } = useCenterSettings();
  const { isDesktop, updateStatus } = useDesktop();
  const [updateModalOpen, setUpdateModalOpen] = React.useState(false);
  const [logoError, setLogoError] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(() => {
    try {
      return typeof localStorage !== 'undefined'
        ? localStorage.getItem('edu_sidebar_collapsed') === 'true'
        : false;
    } catch {
      return false;
    }
  });
  const [dark, setDark] = React.useState(() => {
    try {
      return typeof localStorage !== 'undefined' ? localStorage.getItem('edu_theme') === 'dark' : false;
    } catch {
      return false;
    }
  });

  React.useEffect(() => {
    setLogoError(false);
  }, [settings?.logoUrl]);

  React.useEffect(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('edu_sidebar_collapsed', String(collapsed));
      }
    } catch {
      // ignore storage errors
    }
  }, [collapsed]);

  React.useEffect(() => {
    try {
      if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('dark', dark);
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('edu_theme', dark ? 'dark' : 'light');
      }
    } catch {
      // ignore storage errors
    }
  }, [dark]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const visibleNav = SIDEBAR_NAV_ITEMS.filter((item) => {
    if (item.to === '/settings' && user.roleCode !== SystemRole.OWNER) return false;
    if (item.requiredRole && user.roleCode !== item.requiredRole) return false;
    if (item.permission && !hasPermission(item.permission as any)) return false;
    if (item.anyPermissions && !item.anyPermissions.some((p) => hasPermission(p as any))) return false;
    return true;
  });

  return (
    <div className="flex min-h-screen bg-background text-foreground" dir="rtl">
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 lg:hidden no-print"
        />
      )}

      <aside
        data-testid="app-sidebar"
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex flex-col border-l border-border bg-card transition-all duration-300 ease-in-out lg:static lg:translate-x-0 no-print',
          collapsed ? 'w-72 lg:w-20' : 'w-72',
          mobileOpen ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <div
          className={cn(
            'flex h-16 items-center border-b border-border transition-all duration-300',
            collapsed ? 'px-3 justify-center' : 'px-5 justify-between',
          )}
        >
          {/* Expanded state on desktop & full state on mobile */}
          <div className={cn('flex items-center gap-2.5 min-w-0', collapsed && 'lg:hidden')}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary text-primary-foreground shadow-sm">
              {settings.logoUrl && !logoError ? (
                <img
                  src={settings.logoUrl}
                  alt={settings.centerName}
                  className="h-full w-full object-cover"
                  onError={() => setLogoError(true)}
                />
              ) : (
                <GraduationCap className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold leading-tight">
                {settings.centerName || 'سنتر النخبة التعليمي'}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {settings.centerSubtitle || 'نظام الإدارة المتكامل'}
              </p>
            </div>
          </div>

          {/* Desktop toggle button when expanded */}
          {!collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="hidden lg:flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              title="طي القائمة الجانبية"
              aria-label="طي القائمة الجانبية"
              data-testid="sidebar-toggle-btn"
            >
              <PanelRightClose className="h-4 w-4" />
            </button>
          )}

          {/* Collapsed state single interactive mini-logo on desktop */}
          {collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              className="group relative hidden lg:flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary text-primary-foreground shadow-sm hover:ring-2 hover:ring-primary/40 transition-all cursor-pointer"
              title="توسيع القائمة الجانبية"
              aria-label="توسيع القائمة الجانبية"
              data-testid="sidebar-logo-expand-btn"
            >
              <div className="flex h-full w-full items-center justify-center group-hover:opacity-0 transition-opacity">
                {settings.logoUrl && !logoError ? (
                  <img
                    src={settings.logoUrl}
                    alt={settings.centerName}
                    className="h-full w-full object-cover"
                    onError={() => setLogoError(true)}
                  />
                ) : (
                  <GraduationCap className="h-5 w-5" />
                )}
              </div>
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-primary text-primary-foreground">
                <PanelRightOpen className="h-4 w-4" />
              </div>
            </button>
          )}

          {/* Mobile close button */}
          <button onClick={() => setMobileOpen(false)} className="lg:hidden shrink-0">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className={cn('flex-1 space-y-1 overflow-y-auto p-3 transition-all', collapsed && 'lg:p-2')}>
          {visibleNav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={() => setMobileOpen(false)}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-xl py-2.5 text-sm font-semibold transition-all',
                    collapsed ? 'px-3.5 lg:justify-center lg:px-0' : 'px-3.5',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className={cn('truncate transition-opacity', collapsed && 'lg:hidden')}>
                  {item.label}
                </span>
              </NavLink>
            );
          })}
        </nav>

        <div
          className={cn(
            'border-t border-border p-4 transition-all',
            collapsed && 'lg:p-2.5 lg:flex lg:flex-col lg:items-center',
          )}
        >
          <div className={cn('mb-3 flex items-center justify-between', collapsed && 'lg:hidden')}>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{user.fullName}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
            <Badge variant="info">{user.roleNameAr}</Badge>
          </div>

          {collapsed && (
            <div
              className="hidden lg:flex mb-2 h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-bold text-foreground"
              title={`${user.fullName} (${user.roleNameAr})`}
            >
              {user.fullName.slice(0, 1)}
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            className={cn('w-full', collapsed && 'lg:w-9 lg:h-9 lg:p-0 lg:justify-center')}
            onClick={logout}
            title="تسجيل الخروج"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span className={cn(collapsed && 'lg:hidden')}>تسجيل الخروج</span>
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card/85 px-4 backdrop-blur lg:px-8 no-print">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="hidden lg:flex text-muted-foreground hover:text-foreground"
              onClick={() => setCollapsed((c) => !c)}
              title={collapsed ? 'توسيع القائمة الجانبية' : 'طي القائمة الجانبية'}
              aria-label={collapsed ? 'توسيع القائمة الجانبية' : 'طي القائمة الجانبية'}
              data-testid="header-sidebar-toggle-btn"
            >
              {collapsed ? (
                <PanelRightOpen className="h-5 w-5" />
              ) : (
                <PanelRightClose className="h-5 w-5" />
              )}
            </Button>
            <span className="text-sm font-semibold text-muted-foreground">
              فرع الإدارة الرئيسي • نظام التشغيل المحاسبي والأكاديمي
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Prominent Cloud Sync (Push & Pull via Supabase) */}
            <HeaderCloudSyncButton />

            {/* Desktop Auto-Update Button (always accessible in desktop mode) */}
            {isDesktop && (
              <button
                type="button"
                onClick={() => setUpdateModalOpen(true)}
                data-testid="header-desktop-update-btn"
                title="التحقق من تحديثات البرنامج عبر GitHub Releases"
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold shadow-sm transition-colors',
                  updateStatus?.state === 'DOWNLOADED'
                    ? 'border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300'
                    : updateStatus?.state === 'DOWNLOADING' || updateStatus?.state === 'CHECKING'
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : 'border-border bg-card hover:bg-accent hover:text-accent-foreground text-foreground font-semibold',
                )}
              >
                {updateStatus?.state === 'DOWNLOADED' ? (
                  <>
                    <RotateCw className="h-3.5 w-3.5 shrink-0" />
                    <span>تثبيت التحديث v{updateStatus.availableVersion}</span>
                  </>
                ) : updateStatus?.state === 'DOWNLOADING' || updateStatus?.state === 'CHECKING' ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                    <span>
                      {updateStatus.state === 'DOWNLOADING'
                        ? `جاري التحديث ${updateStatus.downloadPercent ?? 0}%`
                        : 'جاري فحص التحديث...'}
                    </span>
                  </>
                ) : (
                  <>
                    <CloudDownload className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="hidden md:inline">تحديث البرنامج</span>
                  </>
                )}
              </button>
            )}

            {/* Creator Branding Badge */}
            <div
              className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs text-muted-foreground select-none"
              title="تم التطوير والإنشاء بواسطة nazzem edu"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-normal">تم الإنشاء بواسطة</span>
              <span className="font-extrabold text-foreground tracking-tight">nazzem edu</span>
            </div>

            {/* Documentation Portal Link */}
            <Link
              to="/docs"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card hover:bg-accent hover:text-accent-foreground px-2.5 py-1.5 text-xs font-semibold text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              title="دليل وتوثيق صفحات النظام"
              data-testid="header-docs-btn"
            >
              <BookOpen className="h-3.5 w-3.5 text-primary shrink-0" />
              <span>التوثيق</span>
            </Link>

            <Button
              variant="outline"
              size="icon"
              onClick={() => setDark((d) => !d)}
              title={dark ? 'الوضع الفاتح' : 'الوضع الداكن'}
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8">
          <ErrorBoundary resetKey={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>

      {isDesktop && updateModalOpen && (
        <DesktopUpdateModal
          open={updateModalOpen}
          onOpenChange={setUpdateModalOpen}
        />
      )}
    </div>
  );
}
