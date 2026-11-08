import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ToastProvider } from '@/design-system';
import { BackupUploadModal } from './backup-upload-modal';
import { backupsApi } from '../backups-api';

vi.mock('../backups-api', () => ({
  backupsApi: {
    upload: vi.fn(),
  },
}));

describe('BackupUploadModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = (props: {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    onRestoreFromUploaded?: (record: any) => void;
  } = {}) => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    return render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <BackupUploadModal
            open={props.open ?? true}
            onOpenChange={props.onOpenChange ?? vi.fn()}
            onRestoreFromUploaded={props.onRestoreFromUploaded}
          />
        </ToastProvider>
      </QueryClientProvider>,
    );
  };

  it('renders modal with drag and drop zone', () => {
    renderComponent();

    expect(screen.getByText('رفع نسخة احتياطية من جهازك')).toBeInTheDocument();
    expect(
      screen.getByText(/اسحب ملف النسخة الاحتياطية وأفلته هنا/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/يدعم ملفات: \.sql أو \.sql\.gz/i)).toBeInTheDocument();
  });

  it('rejects unsupported file formats', () => {
    renderComponent();

    const input = screen.getByTestId('backup-file-input');
    const invalidFile = new File(['test'], 'report.pdf', { type: 'application/pdf' });

    fireEvent.change(input, { target: { files: [invalidFile] } });

    expect(
      screen.getByText(/نوع الملف غير مدعوم\. يُرجى اختيار ملف قاعدة بيانات/i),
    ).toBeInTheDocument();
  });

  it('selects valid .sql file and executes upload flow', async () => {
    const mockRecord = {
      id: 'rec-uploaded-1',
      fileName: 'upload-test-backup.sql.gz',
      filePath: '/storage/backups/upload-test-backup.sql.gz',
      fileSizeBytes: 2048576,
      triggerType: 'UPLOADED',
      destinations: ['SERVER_STORAGE'],
      checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      status: 'SUCCESS',
      createdAt: new Date().toISOString(),
      errorMessage: null,
    };
    vi.mocked(backupsApi.upload).mockResolvedValue(mockRecord as any);

    const onRestoreMock = vi.fn();
    renderComponent({ onRestoreFromUploaded: onRestoreMock });

    const input = screen.getByTestId('backup-file-input');
    const validFile = new File(['CREATE TABLE x();'], 'backup.sql', { type: 'text/plain' });

    fireEvent.change(input, { target: { files: [validFile] } });

    expect(screen.getByText('backup.sql')).toBeInTheDocument();

    const uploadBtn = screen.getByRole('button', { name: /بدء رفع الملف وحفظه/i });
    fireEvent.click(uploadBtn);

    expect(await screen.findByText('تم رفع النسخة الاحتياطية بنجاح!')).toBeInTheDocument();
    expect(screen.getByText('upload-test-backup.sql.gz')).toBeInTheDocument();

    const restoreNowBtn = screen.getByRole('button', {
      name: /استعادة قاعدة البيانات من هذه النسخة الآن/i,
    });
    fireEvent.click(restoreNowBtn);

    expect(onRestoreMock).toHaveBeenCalledWith(mockRecord);
  });
});
