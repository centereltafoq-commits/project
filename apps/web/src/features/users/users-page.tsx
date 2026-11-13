import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, Plus, Power, RotateCcw, ShieldCheck, Users } from 'lucide-react';
import { DEFAULT_PAGE_SIZE, PaginatedResult, PERMISSIONS } from '@edu-center/shared';
import {
  Badge,
  Button,
  Input,
  Modal,
  PageHeader,
  Select,
  ServerDataTable,
  TableColumn,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useToast,
} from '@/design-system';
import { useAuth } from '@/features/auth/auth-context';
import { useDebounce } from '@/hooks/use-debounce';
import { apiClient, extractErrorMessage } from '@/lib/api-client';
import { formatDateTimeAr } from '@/lib/formatters';
import { RolesPermissionsTab } from './roles-permissions-tab';
import {
  UserQuickViewModal,
  UserRow,
} from './components/user-quick-view-modal';

interface RoleOption {
  id: string;
  code: string;
  nameAr: string;
}

export function UsersPage() {
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const { hasPermission } = useAuth();
  const canViewUsers = hasPermission(PERMISSIONS.USERS_VIEW);
  const canManageUsers = hasPermission(PERMISSIONS.USERS_MANAGE);
  const canManageRoles = hasPermission(PERMISSIONS.ROLES_MANAGE);

  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [roleFilter, setRoleFilter] = React.useState('');

  const [modalOpen, setModalOpen] = React.useState(false);
  const [quickViewUser, setQuickViewUser] = React.useState<UserRow | null>(null);
  const [quickViewOpen, setQuickViewOpen] = React.useState(false);

  const EMPTY_FORM = React.useMemo(
    () => ({
      fullName: '',
      email: '',
      phone: '',
      password: '',
      roleId: '',
    }),
    [],
  );

  const [form, setForm] = React.useState(EMPTY_FORM);

  const resetUserForm = React.useCallback(() => {
    setForm(EMPTY_FORM);
  }, [EMPTY_FORM]);

  const handleModalOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        resetUserForm();
      }
      setModalOpen(nextOpen);
    },
    [resetUserForm],
  );

  const { data: roles = [] } = useQuery<RoleOption[]>({
    queryKey: ['roles'],
    enabled: canViewUsers || canManageUsers || canManageRoles,
    queryFn: async () => (await apiClient.get('/roles')).data,
  });

  const { data, isLoading } = useQuery<PaginatedResult<UserRow>>({
    queryKey: ['users', page, limit, debouncedSearch, roleFilter],
    enabled: canViewUsers,
    queryFn: async () => {
      const res = await apiClient.get('/users', {
        params: {
          page,
          limit,
          search: debouncedSearch || undefined,
          roleId: roleFilter || undefined,
        },
      });
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => apiClient.post('/users', form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setModalOpen(false);
      setForm({ fullName: '', email: '', phone: '', password: '', roleId: '' });
      notify('تم إنشاء حساب المستخدم بنجاح', 'success');
    },
    onError: (err) => notify(extractErrorMessage(err), 'error'),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async (u: UserRow) =>
      apiClient.patch(`/users/${u.id}`, { isActive: !u.isActive }),
    onSuccess: (_, u) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      if (quickViewUser && quickViewUser.id === u.id) {
        setQuickViewUser({ ...quickViewUser, isActive: !quickViewUser.isActive });
      }
      notify('تم تحديث حالة حساب المستخدم', 'success');
    },
    onError: (err) => notify(extractErrorMessage(err), 'error'),
  });

  const columns: TableColumn<UserRow>[] = [
    {
      key: 'fullName',
      header: 'الاسم الكامل',
      className: 'whitespace-nowrap',
      render: (row) => (
        <span className="font-bold text-foreground hover:text-primary transition-colors cursor-pointer text-xs">
          {row.fullName}
        </span>
      ),
    },
    {
      key: 'contact',
      header: 'البريد والهاتف',
      className: 'whitespace-nowrap',
      render: (row) => (
        <div>
          <div className="text-xs text-foreground font-medium">{row.email}</div>
          <div className="font-mono text-[11px] text-muted-foreground" dir="ltr">
            {row.phone || '—'}
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'الدور الوظيفي',
      className: 'whitespace-nowrap',
      render: (row) => <Badge variant="purple" className="text-xs">{row.roleNameAr}</Badge>,
    },
    {
      key: 'status',
      header: 'الحالة',
      className: 'whitespace-nowrap',
      render: (row) =>
        row.isActive ? (
          <Badge variant="success" className="text-xs">نشط</Badge>
        ) : (
          <Badge variant="danger" className="text-xs">متوقف</Badge>
        ),
    },
    {
      key: 'lastLogin',
      header: 'آخر دخول',
      className: 'whitespace-nowrap font-mono text-xs text-muted-foreground',
      render: (row) =>
        row.lastLoginAt ? formatDateTimeAr(row.lastLoginAt) : 'لم يسجل دخول بعد',
    },
    {
      key: 'actions',
      header: 'إجراءات',
      className: 'whitespace-nowrap text-left pl-4',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1 px-2.5 text-xs font-bold"
            onClick={() => {
              setQuickViewUser(row);
              setQuickViewOpen(true);
            }}
          >
            <Eye className="h-3.5 w-3.5 text-primary" />
            تفاصيل
          </Button>
          {canManageUsers && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => toggleActiveMutation.mutate(row)}
              isLoading={toggleActiveMutation.isPending && toggleActiveMutation.variables?.id === row.id}
            >
              <Power className="h-3.5 w-3.5" />
              {row.isActive ? 'إيقاف' : 'تفعيل'}
            </Button>
          )}
        </div>
      ),
    },
  ];

  const hasActiveFilters = Boolean(roleFilter || search);

  return (
    <div>
      <PageHeader
        title="المستخدمون والصلاحيات القابلة للتخصيص"
        description="إدارة حسابات فريق السنتر وتخصيص صلاحيات الأدوار الوظيفية بدقة"
        actions={
          canManageUsers ? (
            <Button
              onClick={() => {
                resetUserForm();
                setModalOpen(true);
              }}
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" />
              إضافة مستخدم جديد
            </Button>
          ) : undefined
        }
      />

      <Tabs defaultValue={canViewUsers ? 'users' : 'roles'}>
        {canViewUsers && canManageRoles && (
          <TabsList>
            <TabsTrigger value="users">
              <Users className="h-4 w-4" />
              حسابات المستخدمين
            </TabsTrigger>
            <TabsTrigger value="roles">
              <ShieldCheck className="h-4 w-4" />
              الأدوار وتخصيص الصلاحيات
            </TabsTrigger>
          </TabsList>
        )}

        {canViewUsers && (
          <TabsContent value="users">
            <ServerDataTable
              columns={columns}
              data={data?.data ?? []}
              meta={data?.meta}
              isLoading={isLoading}
              rowKey={(r) => r.id}
              onRowClick={(r) => {
                setQuickViewUser(r);
                setQuickViewOpen(true);
              }}
              searchPlaceholder="ابحث بالاسم أو البريد أو الهاتف..."
              searchValue={search}
              onSearchChange={(val) => {
                setSearch(val);
                setPage(1);
              }}
              page={page}
              onPageChange={setPage}
              limit={limit}
              onLimitChange={(l) => {
                setLimit(l);
                setPage(1);
              }}
              filters={
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    searchable
                    searchPlaceholder="ابحث في الأدوار..."
                    placeholder="كل الأدوار الوظيفية"
                    value={roleFilter}
                    onChange={(e) => {
                      setRoleFilter(e.target.value);
                      setPage(1);
                    }}
                    options={roles.map((r) => ({ value: r.id, label: r.nameAr }))}
                    className="w-48"
                  />
                  {hasActiveFilters && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setRoleFilter('');
                        setSearch('');
                        setPage(1);
                      }}
                      className="gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      مسح الفلاتر
                    </Button>
                  )}
                </div>
              }
            />
          </TabsContent>
        )}

        {canManageRoles && (
          <TabsContent value="roles">
            <RolesPermissionsTab />
          </TabsContent>
        )}
      </Tabs>

      <UserQuickViewModal
        open={quickViewOpen}
        onOpenChange={setQuickViewOpen}
        user={quickViewUser}
        onToggleActive={canManageUsers ? (u) => toggleActiveMutation.mutate(u) : undefined}
        isToggling={toggleActiveMutation.isPending}
      />

      <Modal
        open={modalOpen}
        onOpenChange={handleModalOpenChange}
        title="إضافة مستخدم جديد"
        description="أنشئ حساب دخول لموظف أو محاسب أو مدرس وحدد دوره الوظيفي"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
          className="space-y-4"
        >
          <Input
            label="الاسم بالكامل"
            required
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          />
          <Input
            label="البريد الإلكتروني"
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <Input
            label="رقم الهاتف"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <Input
            label="كلمة المرور (8 أحرف على الأقل)"
            type="password"
            required
            minLength={8}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <Select
            searchable
            searchPlaceholder="ابحث في الأدوار الوظيفية..."
            label="الدور الوظيفي"
            required
            placeholder="اختر الدور الوظيفي"
            value={form.roleId}
            onChange={(e) => setForm({ ...form, roleId: e.target.value })}
            options={roles.map((r) => ({ value: r.id, label: r.nameAr }))}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => handleModalOpenChange(false)}>
              إلغاء
            </Button>
            <Button type="submit" isLoading={createMutation.isPending}>
              إنشاء الحساب
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
