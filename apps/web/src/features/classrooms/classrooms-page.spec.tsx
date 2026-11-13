import * as React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import * as authContextModule from '@/features/auth/auth-context';
import { apiClient } from '@/lib/api-client';
import { ClassroomsPage } from './classrooms-page';

vi.mock('@/features/auth/auth-context', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  extractErrorMessage: (e: unknown) => String(e),
}));

describe('ClassroomsPage Schedule Modal Reproduction', () => {
  const useAuthMock = vi.mocked(authContextModule.useAuth);
  const getMock = vi.mocked(apiClient.get);

  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue({
      hasPermission: () => true,
      user: { id: 'u-1', fullName: 'Admin', roleCode: 'OWNER' },
    } as any);
  });

  it('clicks schedule button on R-101 without crashing or blanking the page', async () => {
    getMock.mockImplementation((url: string) => {
      if (url === '/classrooms/unallocated-groups') {
        return Promise.resolve({ data: [] });
      }
      if (url === '/classrooms') {
        return Promise.resolve({
          data: {
            data: [
              {
                id: 'b09b4c19-9c11-4985-ac13-cc868123a072',
                roomNumber: 'R-101',
                name: 'قاعة الخوارزمي الكبرى',
                maxCapacity: 80,
                seatsCount: 80,
                equipment: [],
                status: 'AVAILABLE',
                notes: 'مخصصة لمجموعات الصف الثالث الثانوي الكبرى',
                createdAt: '2026-11-07T02:35:51.151Z',
              },
              {
                id: 'e6931736-11c5-4bb8-97af-6fe20ce2e83c',
                roomNumber: 'QA-1211',
                name: 'اختبار QA 1211 قاعة',
                maxCapacity: 45,
                seatsCount: 40,
                equipment: [],
                status: 'AVAILABLE',
                notes: '',
                createdAt: '2026-11-12T14:04:08.893Z',
              },
            ],
            meta: { page: 1, limit: 10, totalItems: 2, totalPages: 1 },
          },
        });
      }
      if (url.includes('/e6931736-11c5-4bb8-97af-6fe20ce2e83c/schedule')) {
        return Promise.resolve({
          data: {
            classroom: {
              id: 'e6931736-11c5-4bb8-97af-6fe20ce2e83c',
              roomNumber: 'QA-1211',
              name: 'اختبار QA 1211 قاعة',
              maxCapacity: 45,
              seatsCount: 40,
              equipment: [],
              status: 'AVAILABLE',
              notes: '',
            },
            from: '2026-11-13',
            to: '2026-11-19',
            sessions: [],
            maintenances: [],
            allocatedGroups: [
              {
                id: 'group-qa-1211',
                groupCode: 'GRP-9882',
                name: 'مجموعة اختبار QA 1211',
                subject: 'الفيزياء',
                gradeLevel: 'الصف الثاني الثانوي',
                teacherName: 'أ. مدرس QA 1211',
                defaultClassroomId: 'e6931736-11c5-4bb8-97af-6fe20ce2e83c',
                scheduleSlots: [{ dayOfWeek: 4, startTime: '14:00', endTime: '16:00' }],
                maxStudents: 30,
                slotsForThisRoom: [],
              },
            ],
          },
        });
      }
      if (url.includes('/schedule')) {
        return Promise.resolve({
          data: {
            classroom: {
              id: 'b09b4c19-9c11-4985-ac13-cc868123a072',
              roomNumber: 'R-101',
              name: 'قاعة الخوارزمي الكبرى',
              maxCapacity: 80,
              seatsCount: 80,
              equipment: [],
              status: 'AVAILABLE',
              notes: 'مخصصة لمجموعات الصف الثالث الثانوي الكبرى',
            },
            from: '2026-11-13',
            to: '2026-11-19',
            sessions: [],
            maintenances: [],
            allocatedGroups: [
              {
                id: '0acb4043-f9c1-4cf6-8b8e-a02ade9fd0bf',
                groupCode: 'GRP-MATH-3S',
                name: 'مجموعة الرياضيات - الصف الثالث الثانوي',
                subject: 'الرياضيات',
                gradeLevel: 'الصف الثالث الثانوي',
                teacherName: 'أ. محمود عبد الرحمن الشرقاوي',
                defaultClassroomId: 'b09b4c19-9c11-4985-ac13-cc868123a072',
                scheduleSlots: [
                  { endTime: '18:00', dayOfWeek: 0, startTime: '16:00' },
                  { endTime: '18:00', dayOfWeek: 3, startTime: '16:00' },
                ],
                maxStudents: 75,
                slotsForThisRoom: [
                  { endTime: '18:00', dayOfWeek: 0, startTime: '16:00' },
                  { endTime: '18:00', dayOfWeek: 3, startTime: '16:00' },
                ],
              },
            ],
          },
        });
      }
      return Promise.resolve({ data: {} });
    });

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ClassroomsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const scheduleBtns = await screen.findAllByRole('button', { name: /الجدول/i });
    expect(scheduleBtns).toHaveLength(2);

    // 1. Open schedule modal for R-101, switch across all tabs, then close it
    fireEvent.click(scheduleBtns[0]!);
    await waitFor(() => {
      expect(screen.getByText(/جدول القاعة وإشغال المجموعات: قاعة الخوارزمي الكبرى/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /الحصص المؤرخة/i }));
    expect(screen.getByText(/لا توجد حصص مجدولة في هذه الفترة/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /المجموعات المسكنة/i }));
    expect(screen.getAllByText(/مجموعة الرياضيات - الصف الثالث الثانوي/i).length).toBeGreaterThan(0);

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByText(/جدول القاعة وإشغال المجموعات: قاعة الخوارزمي الكبرى/i)).not.toBeInTheDocument();
    });

    // 2. Reopen schedule modal on QA-1211 (which uses default classroom fallback when slotsForThisRoom is [])
    fireEvent.click(scheduleBtns[1]!);
    await waitFor(() => {
      expect(screen.getByText(/جدول القاعة وإشغال المجموعات: اختبار QA 1211 قاعة/i)).toBeInTheDocument();
    });

    // Weekly tab should start reset to 'weekly' on reopen and display QA-1211 group slots
    await waitFor(() => {
      expect(screen.getAllByText(/مجموعة اختبار QA 1211/i).length).toBeGreaterThan(0);
    });

    // Groups tab should fallback to scheduleSlots even when slotsForThisRoom is []
    fireEvent.click(screen.getByRole('button', { name: /المجموعات المسكنة/i }));
    expect(screen.getByText(/GRP-9882/i)).toBeInTheDocument();
  });
});

