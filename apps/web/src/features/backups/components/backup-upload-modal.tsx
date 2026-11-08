import * as React from 'react';
import { useState, useRef } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  FileCode2,
  HardDrive,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Upload,
  UploadCloud,
  X,
} from 'lucide-react';
import { Button, Modal, useToast } from '@/design-system';
import { cn } from '@/lib/cn';
import { extractErrorMessage } from '@/lib/api-client';
import { BackupRecord } from '../backups.types';
import { useBackupMutations } from '../use-backups';

interface BackupUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestoreFromUploaded?: (record: BackupRecord) => void;
}

export function BackupUploadModal({
  open,
  onOpenChange,
  onRestoreFromUploaded,
}: BackupUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadedRecord, setUploadedRecord] = useState<BackupRecord | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadMutation } = useBackupMutations();
  const { notify } = useToast();

  const resetState = () => {
    setSelectedFile(null);
    setIsDragOver(false);
    setUploadedRecord(null);
    setErrorMessage(null);
  };

  React.useEffect(() => {
    if (open) {
      resetState();
    }
  }, [open]);

  const validateAndSetFile = (file: File) => {
    setErrorMessage(null);
    const name = file.name.toLowerCase();
    const isGz = name.endsWith('.sql.gz') || name.endsWith('.gz');
    const isSql = name.endsWith('.sql');

    if (!isGz && !isSql) {
      setErrorMessage('نوع الملف غير مدعوم. يُرجى اختيار ملف قاعدة بيانات بامتداد .sql أو .sql.gz');
      return;
    }

    if (file.size > 300 * 1024 * 1024) {
      setErrorMessage('حجم الملف يتجاوز الحد الأقصى المسموح به (300 ميجابايت)');
      return;
    }

    setSelectedFile(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  const handleUpload = () => {
    if (!selectedFile) return;

    setErrorMessage(null);
    uploadMutation.mutate(selectedFile, {
      onSuccess: (record) => {
        setUploadedRecord(record);
        notify('تم رفع ملف النسخة الاحتياطية والتحقق من كود الأمان بنجاح', 'success');
      },
      onError: (err: any) => {
        setErrorMessage(
          err.response?.data?.message ||
            extractErrorMessage(err) ||
            'فشل رفع ملف النسخة الاحتياطية. يرجى المحاولة مرة أخرى.',
        );
      },
    });
  };

  const handleClose = (v: boolean) => {
    if (!v) {
      resetState();
    }
    onOpenChange(v);
  };

  return (
    <Modal
      open={open}
      onOpenChange={handleClose}
      title="رفع نسخة احتياطية من جهازك"
      description="اختر ملف قاعدة بيانات (.sql أو .sql.gz) من جهازك للتحقق منه وحفظه واستعادة النظام منه"
      size="md"
    >
      <div className="space-y-4">
        <input
          ref={fileInputRef}
          type="file"
          data-testid="backup-file-input"
          accept=".sql,.sql.gz,.gz,application/gzip,application/x-gzip,text/plain"
          onChange={handleFileChange}
          className="hidden"
        />

        {errorMessage && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {uploadedRecord ? (
          /* Success Screen */
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-700 dark:text-emerald-400">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-bold text-sm">تم رفع النسخة الاحتياطية بنجاح!</h4>
                  <p className="text-xs">
                    تم تخزين النسخة على السيرفر، وتوليد كود التشفير والتحقق من سلامتها. أصبحت مسجلة
                    في قائمة النسخ وجاهزة للاستعادة في أي وقت.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-border">
                <span className="text-muted-foreground">اسم الملف المحفوظ:</span>
                <span className="font-mono font-bold text-foreground" dir="ltr">
                  {uploadedRecord.fileName}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-border">
                <span className="text-muted-foreground">الحجم على القرص:</span>
                <span className="font-mono text-foreground" dir="ltr">
                  {uploadedRecord.fileSizeBytes
                    ? `${(uploadedRecord.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB`
                    : '-'}
                </span>
              </div>
              {uploadedRecord.checksum && (
                <div className="flex justify-between items-center py-1">
                  <span className="text-muted-foreground">كود التشفير (SHA-256):</span>
                  <span
                    className="font-mono text-[10px] text-muted-foreground bg-muted p-1 rounded max-w-[200px] truncate"
                    title={uploadedRecord.checksum}
                  >
                    {uploadedRecord.checksum}
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => handleClose(false)}
                className="text-xs"
              >
                إغلاق والعودة للسجل
              </Button>
              {onRestoreFromUploaded && (
                <Button
                  variant="primary"
                  onClick={() => {
                    handleClose(false);
                    onRestoreFromUploaded(uploadedRecord);
                  }}
                  className="gap-1.5 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>استعادة قاعدة البيانات من هذه النسخة الآن</span>
                </Button>
              )}
            </div>
          </div>
        ) : (
          /* File Selection / Dropzone Screen */
          <div className="space-y-4">
            {!selectedFile ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'group relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-all cursor-pointer',
                  isDragOver
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-muted/20 hover:border-primary/50 hover:bg-muted/40',
                )}
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-3 transition-transform group-hover:scale-110">
                  <UploadCloud className="h-7 w-7" />
                </div>
                <h4 className="text-sm font-bold text-foreground">
                  اسحب ملف النسخة الاحتياطية وأفلته هنا
                </h4>
                <p className="text-xs text-muted-foreground mt-1">
                  أو اضغط في أي مكان لتصفح واختيار الملف من جهازك
                </p>
                <div className="flex items-center gap-2 mt-4 text-[11px] text-muted-foreground bg-muted/60 px-3 py-1 rounded-full border border-border">
                  <Database className="h-3 w-3 text-primary" />
                  <span>يدعم ملفات: .sql أو .sql.gz (أقصى حجم: 300 ميجابايت)</span>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <FileCode2 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-mono text-xs font-bold text-foreground" dir="ltr">
                        {selectedFile.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground font-mono">
                        {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedFile(null)}
                    disabled={uploadMutation.isPending}
                    className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-muted transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="rounded-lg bg-muted/40 p-2.5 text-xs text-muted-foreground flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>
                    سيقوم النظام بحساب كود التحقق SHA-256 وحفظ الملف بأمان في مسار التخزين.
                  </span>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                onClick={() => handleClose(false)}
                disabled={uploadMutation.isPending}
              >
                إلغاء
              </Button>
              <Button
                variant="primary"
                onClick={handleUpload}
                disabled={!selectedFile || uploadMutation.isPending}
                className="gap-2"
              >
                {uploadMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>جاري الرفع والتحقق...</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    <span>بدء رفع الملف وحفظه</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
