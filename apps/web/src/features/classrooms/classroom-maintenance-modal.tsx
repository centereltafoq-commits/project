import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { PERMISSIONS } from '@edu-center/shared';
import { Button, Input, Modal, useToast } from '@/design-system';
import { useAuth } from '@/features/auth/auth-context';
import { apiClient, extractErrorMessage } from '@/lib/api-client';
import { formatDateTimeAr } from '@/lib/formatters';
import { confirmAction } from '@/lib/alerts';
import { ClassroomMaintenanceItem, ClassroomRow } from './classrooms.types';

interface ClassroomMaintenanceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classroom: ClassroomRow | null;
}

export function ClassroomMaintenanceModal({
  open,
  onOpenChange,
  classroom,
}: ClassroomMaintenanceModalProps) {
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const { hasPermission } = useAuth();
  const canManageClassrooms = hasPermission(PERMISSIONS.CLASSROOMS_MANAGE);

  const [startAt, setStartAt] = React.useState('');
  const [endAt, setEndAt] = React.useState('');
  const [reason, setReason] = React.useState('');

  const { data, isLoading } = useQuery<{ maintenances: ClassroomMaintenanceItem[] }>({
    queryKey: ['classroom-detail', classroom?.id],
    enabled: Boolean(open && classroom?.id),
    queryFn: async () => (await apiClient.get(`/classrooms/${classroom!.id}`)).data,
  });

  const addMutation = useMutation({
    mutationFn: async () =>
      apiClient.post(`/classrooms/${classroom!.id}/maintenances`, {
        startAt: new Date(startAt).toISOString(),
        endAt: new Date(endAt).toISOString(),
        reason,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classroom-detail', classroom?.id] });
      queryClient.invalidateQueries({ queryKey: ['classrooms'] });
      queryClient.invalidateQueries({ queryKey: ['classrooms-available'] });
      queryClient.invalidateQueries({ queryKey: ['classroom-schedule', classroom?.id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      setStartAt('');
      setEndAt('');
      setReason('');
      notify('تمت جدولة فترة الصيانة بنجاح', 'success');
    },
    onError: (err) => notify(extractErrorMessage(err), 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (maintId: string) =>
      apiClient.delete(`/classrooms/maintenances/${maintId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classroom-detail', classroom?.id] });
      queryClient.invalidateQueries({ queryKey: ['classrooms'] });
      queryClient.invalidateQueries({ queryKey: ['classrooms-available'] });
      queryClient.invalidateQueries({ queryKey: ['classroom-schedule', classroom?.id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      notify('تم إلغاء فترة الصيانة', 'success');
    },
    onError: (err) => notify(extractErrorMessage(err), 'error'),
  });

  if (!classroom) return null;
  const maintenances = data?.maintenances ?? [];

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={`جدول صيانة القاعة: ${classroom.name} (${classroom.roomNumber})`}
      description="تمنع فترات الصيانة المجدولة تشغيل القاعة تلقائياً خلال الوقت المحدد"
    >
      <div className="space-y-5">
        {canManageClassrooms && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addMutation.mutate();
            }}
            className="space-y-3 rounded-xl border border-border bg-muted/25 p-4"
          >
            <p className="text-sm font-bold">إضافة نافذة صيانة جديدة</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="بداية الصيانة"
                type="datetime-local"
                required
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
              />
              <Input
                label="نهاية الصيانة"
                type="datetime-local"
                required
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
              />
            </div>
            <Input
              label="سبب الصيانة"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="مثال: صيانة التكييف أو تحديث الشاشة التفاعلية"
            />
            <div className="flex justify-end">
              <Button type="submit" size="sm" isLoading={addMutation.isPending}>
                <Plus className="h-4 w-4" />
                تسجيل الصيانة
              </Button>
            </div>
          </form>
        )}

        <div className="space-y-2">
          <p className="text-sm font-bold">سجل الصيانات المسجلة ({maintenances.length})</p>
          {isLoading ? (
            <div className="h-20 animate-pulse rounded-lg bg-muted" />
          ) : maintenances.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              لا توجد فترات صيانة مسجلة لهذه القاعة
            </p>
          ) : (
            maintenances.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border p-3 text-sm"
              >
                <div>
                  <p className="font-bold text-foreground">{m.reason}</p>
                  <p className="text-xs text-muted-foreground">
                    من {formatDateTimeAr(m.startAt)} إلى {formatDateTimeAr(m.endAt)}
                  </p>
                </div>
                {canManageClassrooms && (
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={async () => {
                      const confirmed = await confirmAction({
                        title: 'حذف فترة الصيانة',
                        text: `هل أنت متأكد من حذف فترة الصيانة («${m.reason || 'صيانة مجدولة'}»)؟`,
                        isDestructive: true,
                        confirmButtonText: 'نعم، حذف فترة الصيانة',
                      });
                      if (confirmed) {
                        deleteMutation.mutate(m.id);
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    حذف
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}
