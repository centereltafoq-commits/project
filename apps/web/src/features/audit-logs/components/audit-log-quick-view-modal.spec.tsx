import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { AuditLogQuickViewModal } from './audit-log-quick-view-modal';

describe('AuditLogQuickViewModal', () => {
  const dummyLog = {
    id: 'log-1',
    actorUserId: 'u-1',
    actorName: 'محمود أحمد',
    action: 'CREATE_STUDENT',
    entityType: 'STUDENTS',
    entityId: 'student-999',
    ipAddress: '192.168.1.50',
    createdAt: '2026-11-11T10:00:00.000Z',
    beforeData: null,
    afterData: {
      name: 'علي حسن',
      phone: '01012345678',
      status: 'ACTIVE',
    },
    metadata: {
      actionAr: 'تسجيل طالب جديد',
      entityTypeAr: 'الطلاب',
    },
  };

  it('renders modal with Arabic action and entity badges and actor name', () => {
    render(<AuditLogQuickViewModal log={dummyLog} open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText('تفاصيل العملية المسجلة (Audit Log)')).toBeInTheDocument();
    expect(screen.getAllByText('تسجيل طالب جديد').length).toBeGreaterThan(0);
    expect(screen.getAllByText('الطلاب').length).toBeGreaterThan(0);
    expect(screen.getByText('محمود أحمد')).toBeInTheDocument();
    expect(screen.getByText('CREATE_STUDENT')).toBeInTheDocument();
  });

  it('translates payload keys and values to Arabic and allows toggling JSON view', () => {
    render(<AuditLogQuickViewModal log={dummyLog} open={true} onOpenChange={vi.fn()} />);

    // Arabic keys and values in payload
    expect(screen.getByText('الاسم:')).toBeInTheDocument();
    expect(screen.getByText('علي حسن')).toBeInTheDocument();
    expect(screen.getByText('رقم الهاتف:')).toBeInTheDocument();
    expect(screen.getByText('01012345678')).toBeInTheDocument();
    expect(screen.getByText('الحالة:')).toBeInTheDocument();
    expect(screen.getByText('نشط')).toBeInTheDocument();

    // Toggle to raw JSON
    const jsonToggleButtons = screen.getAllByText(/عرض كود JSON/);
    expect(jsonToggleButtons.length).toBeGreaterThan(0);
    fireEvent.click(jsonToggleButtons[0]);

    // Now should show formatted JSON toggle back
    expect(screen.getByText(/عرض مبسط/)).toBeInTheDocument();
  });

  it('renders array payloads cleanly with Arabic labels without raw JSON dump', () => {
    const arrayLog = {
      ...dummyLog,
      afterData: [
        { studentId: 's-1', status: 'PRESENT' },
        { studentId: 's-2', status: 'ABSENT' },
      ],
    };

    render(<AuditLogQuickViewModal log={arrayLog} open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText('عنصر #1')).toBeInTheDocument();
    expect(screen.getByText('عنصر #2')).toBeInTheDocument();
    expect(screen.getByText('حاضر')).toBeInTheDocument();
    expect(screen.getByText('غائب')).toBeInTheDocument();
  });
});

