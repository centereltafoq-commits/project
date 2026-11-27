import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FullMonthAbsencePolicy, GroupRevenueSplitMethod } from '@edu-center/shared';
import { ToastProvider } from '@/design-system';
import { apiClient } from '@/lib/api-client';
import { SubscribeStudentModal } from './subscribe-student-modal';
import { GroupDetailData } from './groups.types';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
  extractErrorMessage: (e: unknown) => String(e),
}));

const sampleGroup: GroupDetailData = {
  id: 'grp-1',
  groupCode: 'GRP-1',
  name: 'فيزياء 3ث',
  subject: 'الفيزياء',
  gradeLevel: 'الثالث الثانوي',
  primaryTeacherId: 'tch-1',
  primaryTeacherName: 'أ. محمد',
  defaultClassroomId: null,
  defaultClassroomName: null,
  monthlySessionsCount: 4,
  monthlyPrice: '400',
  calculatedSessionPrice: '100',
  scheduleSlots: [],
  maxStudents: 10,
  isActive: true,
  notes: null,
  activeStudentsCount: 1,
  revenueSplitMethod: GroupRevenueSplitMethod.ACTUAL_ATTENDANCE_RATIO,
  teacherSharePerStudent: '300',
  centerSharePerStudent: '100',
  teacherPercentage: '75',
  fullMonthAbsencePolicy: FullMonthAbsencePolicy.EXEMPT_FULL_ABSENCE,
  chargeExcusedAbsence: false,
  financialPolicy: null,
  teachers: [],
  assistants: [],
};

describe('SubscribeStudentModal (Bulk Multi-Select)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
      if (url === '/groups/lookups') {
        return {
          data: {
            students: [
              { id: 'stu-1', studentCode: 'STU-1', fullName: 'أحمد علي', phone: '0101', gradeLevel: 'الثالث الثانوي' },
              { id: 'stu-2', studentCode: 'STU-2', fullName: 'سارة حسن', phone: '0102', gradeLevel: 'الثالث الثانوي' },
              { id: 'stu-3', studentCode: 'STU-3', fullName: 'كريم محمود', phone: '0103', gradeLevel: 'الثاني الثانوي' },
            ],
          },
        } as any;
      }
      if (url === '/groups/grp-1/enrollments/active-student-ids') {
        return { data: { studentIds: ['stu-1'] } } as any;
      }
      return { data: {} } as any;
    });
    vi.mocked(apiClient.post).mockResolvedValue({
      data: { enrolledCount: 2, skippedAlreadyEnrolledCount: 0, createdIds: ['e1', 'e2'] },
    } as any);
  });

  it('marks already-enrolled students disabled, allows multi-selecting others, and submits bulk endpoint', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const onOpenChange = vi.fn();

    render(
      <QueryClientProvider client={qc}>
        <ToastProvider>
          <SubscribeStudentModal open onOpenChange={onOpenChange} group={sampleGroup} />
        </ToastProvider>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('أحمد علي')).toBeInTheDocument();
      expect(screen.getByText('سارة حسن')).toBeInTheDocument();
      expect(screen.getByText('كريم محمود')).toBeInTheDocument();
    });

    expect(screen.getByText('مشترك بالفعل')).toBeInTheDocument();
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes[0]).toBeDisabled();

    fireEvent.click(checkboxes[1]);
    fireEvent.click(checkboxes[2]);

    const submitBtn = screen.getByRole('button', { name: /تأكيد اشتراك \(2\) طالب/i });
    expect(submitBtn).toBeEnabled();
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        '/groups/grp-1/enrollments/bulk',
        expect.objectContaining({
          studentIds: ['stu-2', 'stu-3'],
          agreedMonthlyPrice: 400,
          agreedSessionsCount: 4,
          agreedSessionPrice: 100,
        }),
      );
    });
  });
});
