import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';
import { PERMISSIONS } from '@edu-center/shared';
import { Button, ButtonProps, useToast } from '@/design-system';
import { useAuth } from '@/features/auth/auth-context';
import { apiClient, extractErrorMessage } from '@/lib/api-client';

interface CompleteGroupSessionButtonProps {
  sessionId: string;
  label?: string;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  disabled?: boolean;
  className?: string;
  onCompleted?: () => void;
}

/**
 * 1-click group-level attendance trigger: marks a scheduled session COMPLETED
 * and triggers monthly billing recalculation for all enrolled students in that group.
 */
export function CompleteGroupSessionButton({
  sessionId,
  label = 'تسجيل حضور المجموعة',
  variant = 'success',
  size = 'sm',
  disabled = false,
  className,
  onCompleted,
}: CompleteGroupSessionButtonProps) {
  const { hasPermission } = useAuth();
  const { notify } = useToast();
  const queryClient = useQueryClient();

  const canCompleteGroup =
    hasPermission(PERMISSIONS.ATTENDANCE_RECORD) || hasPermission(PERMISSIONS.SESSIONS_MANAGE);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post(`/attendance/sessions/${sessionId}/complete-group`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['session-sheet', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['finance'] });
      queryClient.invalidateQueries({ queryKey: ['student-profile'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      notify('تم تسجيل حضور المجموعة وتحديث المستحقات المالية تلقائياً', 'success');
      onCompleted?.();
    },
    onError: (err) => {
      notify(extractErrorMessage(err), 'error');
    },
  });

  if (!canCompleteGroup) return null;

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      disabled={disabled}
      isLoading={mutation.isPending}
      className={className}
      onClick={(e) => {
        e.stopPropagation();
        mutation.mutate();
      }}
    >
      <CheckCircle2 className="h-3.5 w-3.5" />
      <span>{label}</span>
    </Button>
  );
}
