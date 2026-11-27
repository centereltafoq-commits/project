import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, Shield } from 'lucide-react';
import { PERMISSIONS, SystemRole } from '@edu-center/shared';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, useToast } from '@/design-system';
import { useAuth } from '@/features/auth/auth-context';
import { apiClient, extractErrorMessage } from '@/lib/api-client';

interface RoleItem {
  id: string;
  code: string;
  nameAr: string;
  description?: string | null;
  permissionCodes: string[];
}

interface PermissionItem {
  id: string;
  code: string;
  module: string;
  nameAr: string;
}

const MODULE_LABELS_AR: Record<string, string> = {
  DASHBOARD: 'لوحة التحكم التنفيذية',
  IDENTITY: 'المستخدمون والأدوار والصلاحيات',
  AUDIT: 'سجل العمليات والمراجعة (Audit)',
  STUDENTS: 'الطلاب',
  TEACHERS: 'المدرسون',
  ASSISTANTS: 'المساعدون',
  GROUPS: 'المجموعات والسياسات',
  ENROLLMENTS: 'اشتراكات الطلاب بالمجموعات',
  SESSIONS: 'الحصص والجدول',
  ATTENDANCE: 'الحضور والغياب',
  FINANCE: 'المالية والتحصيل والأرباح',
  CLASSROOMS: 'القاعات الدراسية',
  CALENDAR: 'التقويم الموحد',
  REPORTS: 'التقارير والتصدير',
  BACKUPS: 'النسخ الاحتياطي والسحابة',
  SETTINGS: 'إعدادات النظام',
};

export function RolesPermissionsTab() {
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const { hasPermission } = useAuth();
  const canManageRoles = hasPermission(PERMISSIONS.ROLES_MANAGE);
  const [selectedRoleId, setSelectedRoleId] = React.useState<string>('');
  const [selectedCodes, setSelectedCodes] = React.useState<string[]>([]);

  const { data: roles = [] } = useQuery<RoleItem[]>({
    queryKey: ['roles'],
    queryFn: async () => (await apiClient.get('/roles')).data,
  });

  const { data: permissions = [] } = useQuery<PermissionItem[]>({
    queryKey: ['permissions'],
    queryFn: async () => (await apiClient.get('/roles/permissions')).data,
  });

  React.useEffect(() => {
    if (roles.length > 0 && !selectedRoleId) {
      const firstEditable = roles.find((r) => r.code !== SystemRole.OWNER) || roles[0];
      setSelectedRoleId(firstEditable.id);
      setSelectedCodes(firstEditable.permissionCodes);
    }
  }, [roles, selectedRoleId]);

  const currentRole = roles.find((r) => r.id === selectedRoleId);

  const handleSelectRole = (role: RoleItem) => {
    setSelectedRoleId(role.id);
    setSelectedCodes(role.permissionCodes);
  };

  const togglePerm = (code: string) => {
    setSelectedCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      await apiClient.put(`/roles/${selectedRoleId}/permissions`, {
        permissionCodes: selectedCodes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      notify('تم حفظ وتخصيص صلاحيات الدور بنجاح', 'success');
    },
    onError: (err) => notify(extractErrorMessage(err), 'error'),
  });

  const grouped = React.useMemo(() => {
    const map = new Map<string, PermissionItem[]>();
    for (const p of permissions) {
      const arr = map.get(p.module) ?? [];
      arr.push(p);
      map.set(p.module, arr);
    }
    return Array.from(map.entries());
  }, [permissions]);

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <div className="space-y-2 lg:col-span-4">
        {roles.map((role) => (
          <button
            key={role.id}
            type="button"
            onClick={() => handleSelectRole(role)}
            className={`flex w-full items-center justify-between rounded-xl border p-4 text-right transition-all ${
              role.id === selectedRoleId
                ? 'border-primary bg-primary/10 shadow-sm'
                : 'border-border bg-card hover:bg-accent/50'
            }`}
          >
            <div>
              <p className="font-bold text-foreground">{role.nameAr}</p>
              <p className="text-xs text-muted-foreground">{role.code}</p>
            </div>
            <Badge variant="info">{role.permissionCodes.length} صلاحية</Badge>
          </button>
        ))}
      </div>

      <div className="lg:col-span-8">
        {currentRole && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle>تخصيص صلاحيات: {currentRole.nameAr}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {currentRole.description ||
                      'يمكنك تفعيل أو إلغاء أي صلاحية فرعية لهذا الدور الوظيفي'}
                  </p>
                </div>
              </div>
              {canManageRoles && currentRole.code !== SystemRole.OWNER && (
                <Button
                  size="sm"
                  onClick={() => saveMutation.mutate()}
                  isLoading={saveMutation.isPending}
                >
                  <Save className="h-4 w-4" />
                  حفظ الصلاحيات
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-5 pt-4">
              {grouped.map(([mod, perms]) => (
                <div key={mod} className="space-y-2">
                  <h4 className="text-xs font-extrabold tracking-wide text-primary">
                    قسم: {MODULE_LABELS_AR[mod] ?? mod}
                  </h4>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {perms.map((perm) => {
                      const checked =
                        currentRole.code === SystemRole.OWNER || selectedCodes.includes(perm.code);
                      const isProfitSensitive = perm.code === PERMISSIONS.FINANCE_VIEW;
                      return (
                        <label
                          key={perm.code}
                          className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 text-sm hover:bg-accent/40 ${
                            isProfitSensitive
                              ? 'border-amber-500/40 bg-amber-500/5'
                              : 'border-border'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={!canManageRoles || currentRole.code === SystemRole.OWNER}
                            onChange={() => togglePerm(perm.code)}
                            className="mt-0.5 h-4 w-4 shrink-0 rounded accent-primary"
                          />
                          <div className="space-y-0.5">
                            <span className="font-medium block leading-snug">{perm.nameAr}</span>
                            {isProfitSensitive && (
                              <span className="inline-block text-[10px] font-bold text-amber-700 dark:text-amber-400">
                                حساسة: تكشف صافي ربح السنتر وأرباح المدرسين (لا تُعطى للأسيستنت)
                              </span>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

