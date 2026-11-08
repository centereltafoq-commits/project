import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Calendar,
  Edit3,
  ExternalLink,
  GraduationCap,
  MessageCircle,
  Phone,
  User,
} from 'lucide-react';
import { PERMISSIONS } from '@edu-center/shared';
import { Badge, Button, Modal } from '@/design-system';
import { useAuth } from '@/features/auth/auth-context';
import { formatDateAr } from '@/lib/formatters';
import { STUDENT_STATUS_META, StudentRow } from '../students.types';

interface StudentQuickViewModalProps {
  student: StudentRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (student: StudentRow) => void;
}

export function StudentQuickViewModal({
  student,
  open,
  onOpenChange,
  onEdit,
}: StudentQuickViewModalProps) {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canUpdateStudent = hasPermission(PERMISSIONS.STUDENTS_UPDATE);

  if (!student) return null;

  const statusMeta = STUDENT_STATUS_META[student.status] ?? {
    label: student.status,
    variant: 'neutral' as const,
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="بطاقة تفاصيل الطالب السريعة"
      description="نظرة فورية شاملة على بيانات التواصل والاشتراكات والقيد"
      size="md"
    >
      <div className="space-y-4">
        {/* ترويسة بطاقة الطالب */}
        <div className="flex items-start justify-between gap-3 rounded-xl border border-border bg-muted/30 p-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-primary/10 px-2.5 py-0.5 font-mono text-xs font-bold text-primary">
                {student.studentCode}
              </span>
              <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
            </div>
            <h3 className="text-lg font-black text-foreground">{student.fullName}</h3>
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <GraduationCap className="h-3.5 w-3.5 text-primary" />
              {student.gradeLevel}
            </p>
          </div>
        </div>

        {/* بيانات التواصل */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* هاتف الطالب */}
          <div className="rounded-xl border border-border bg-card p-3.5">
            <span className="text-xs font-bold text-muted-foreground block flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 text-primary" />
              هاتف الطالب
            </span>
            <p dir="ltr" className="mt-1 text-sm font-mono font-bold text-foreground text-right">
              {student.phone || 'غير مسجل'}
            </p>
            {student.phone && (
              <a
                href={`https://wa.me/2${student.phone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:underline"
              >
                <MessageCircle className="h-3 w-3" />
                مراسلة عبر واتساب
              </a>
            )}
          </div>

          {/* هاتف ولي الأمر */}
          <div className="rounded-xl border border-border bg-card p-3.5">
            <span className="text-xs font-bold text-muted-foreground block flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-purple-600" />
              هاتف ولي الأمر
            </span>
            <p dir="ltr" className="mt-1 text-sm font-mono font-bold text-foreground text-right">
              {student.guardianPhone || 'غير مسجل'}
            </p>
            {student.guardianPhone && (
              <a
                href={`https://wa.me/2${student.guardianPhone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:underline"
              >
                <MessageCircle className="h-3 w-3" />
                مراسلة ولي الأمر
              </a>
            )}
          </div>
        </div>

        {/* المجموعات النشطة وتاريخ التسجيل */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-3.5">
            <span className="text-xs font-bold text-muted-foreground block flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5 text-blue-600" />
              المجموعات الدراسية النشطة
            </span>
            <p className="mt-1 text-sm font-extrabold text-foreground">
              {student.activeGroupsCount ?? 0} مجموعة مفعّلة
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-3.5">
            <span className="text-xs font-bold text-muted-foreground block flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-amber-600" />
              تاريخ التسجيل بالسنتر
            </span>
            <p className="mt-1 text-sm font-medium text-foreground">
              {formatDateAr(student.registrationDate)}
            </p>
          </div>
        </div>

        {/* ملاحظات الطالب إن وجدت */}
        {student.notes && (
          <div className="rounded-xl border border-border bg-muted/20 p-3 text-xs">
            <span className="font-bold text-muted-foreground block mb-1">ملاحظات إدارية:</span>
            <p className="text-foreground">{student.notes}</p>
          </div>
        )}

        {/* أزرار الإجراءات في أسفل النافذة */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
          {canUpdateStudent ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onOpenChange(false);
                onEdit(student);
              }}
              className="gap-1.5"
            >
              <Edit3 className="h-3.5 w-3.5" />
              تعديل البيانات
            </Button>
          ) : (
            <span />
          )}

          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              onOpenChange(false);
              navigate(`/students/${student.id}`);
            }}
            className="gap-1.5 font-bold"
          >
            الملف الأكاديمي والمالي الشامل
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </Modal>
  );
}

