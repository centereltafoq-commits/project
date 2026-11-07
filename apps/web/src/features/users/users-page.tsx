import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Power, ShieldCheck, Users } from 'lucide-react';
import { DEFAULT_PAGE_SIZE, PaginatedResult } from '@edu-center/shared';
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
import { useDebounce } from '@/hooks/use-debounce';
import { apiClient, extractErrorMessage } from '@/lib/api-client';
import { formatDateAr } from '@/lib/formatters';
import { RolesPermissionsTab } from './roles-permissions-tab';

interface UserRow {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  roleId: string;
  roleCode: string;
  roleNameAr: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

interface RoleOption {
  id: string;
  code: string;
  nameAr: string;
}

export function UsersPage() {
  const queryClient = useQueryClient();
  const { notify } = useToast();

  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [roleFilter, setRoleFilter] = React.useState('');

  const [modalOpen, setModalOpen] = React.useState(false);
  const [form, setForm] = React.useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    roleId: '',
  });

  const { data: roles = [] } = useQuery<RoleOption[]>({
    queryKey: ['roles'],
    queryFn: async () => (await apiClient.get('/roles')).data,
  });

  const { data, isLoading } = useQuery<PaginatedResult<UserRow>>({
    queryKey: ['users', page, limit, debouncedSearch, roleFilter],
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      notify('تم تحديث حالة حساب المستخدم', 'success');
    },
    onError: (err) => notify(extractErrorMessage(err), 'error'),
  });

  const columns: TableColumn<UserRow>[] = [
    {
      key: 'fullName',
      header: 'الاسم الكامل',
      render: (row) => <span className="font-bold text-foreground">{row.fullName}</span>,
    },
    {
      key: 'email',
      header: 'البريد الإلكتروني',
      render: (row) => <span className="text-muted-foreground">{row.email}</span>,
    },
    {
      key: 'phone',
      header: 'الهاتف',
      render: (row) => row.phone || '—',
    },
    {
      key: 'role',
      header: 'الدور الوظيفي',
      render: (row) => <Badge variant="purple">{row.roleNameAr}</Badge>,
    },
    {
      key: 'status',
      header: 'الحالة',
      render: (row) =>
        row.isActive ? (
          <Badge variant="success">نشط</Badge>
        ) : (
          <Badge variant="danger">متوقف</Badge>
        ),
    },
    {
      key: 'lastLogin',
      header: 'آخر دخول',
      render: (row) => formatDateAr(row.lastLoginAt),
    },
    {
      key: 'actions',
      header: 'إجراءات',
      render: (row) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => toggleActiveMutation.mutate(row)}
        >
          <Power className="h-3.5 w-3.5" />
          {row.isActive ? 'إيقاف' : 'تفعيل'}
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="المستخدمون والصلاحيات القابلة للتخصيص"
        description="إدارة حسابات فريق السنتر وتخصيص صلاحيات الأدوار الوظيفية بدقة"
        actions={
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" />
            إضافة مستخدم جديد
          </Button>
        }
      />

      <Tabs defaultValue="users">
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

        <TabsContent value="users">
          <ServerDataTable
            columns={columns}
            data={data?.data ?? []}
            meta={data?.meta}
            isLoading={isLoading}
            rowKey={(r) => r.id}
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
              <Select
                placeholder="كل الأدوار الوظيفية"
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value);
                  setPage(1);
                }}
                options={roles.map((r) => ({ value: r.id, label: r.nameAr }))}
                className="w-48"
              />
            }
          />
        </TabsContent>

        <TabsContent value="roles">
          <RolesPermissionsTab />
        </TabsContent>
      </Tabs>

      <Modal
        open={modalOpen}
        onOpenChange={setModalOpen}
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
            label="الدور الوظيفي"
            required
            placeholder="اختر الدور الوظيفي"
            value={form.roleId}
            onChange={(e) => setForm({ ...form, roleId: e.target.value })}
            options={roles.map((r) => ({ value: r.id, label: r.nameAr }))}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
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

