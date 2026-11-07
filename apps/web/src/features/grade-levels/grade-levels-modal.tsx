import * as React from 'react';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  Edit2,
  GraduationCap,
  Loader2,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { Badge } from '@/design-system/components/badge';
import { Button } from '@/design-system/components/button';
import { Input } from '@/design-system/components/input';
import { Modal } from '@/design-system/components/modal';
import { gradeLevelsApi } from './grade-levels-api';
import { GradeLevel } from './grade-levels.types';
import { useGradeLevels } from './use-grade-levels';

interface GradeLevelsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GradeLevelsModal({ open, onOpenChange }: GradeLevelsModalProps) {
  const queryClient = useQueryClient();
  const { gradeLevels, isLoading } = useGradeLevels(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formOrder, setFormOrder] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  const resetForm = () => {
    setEditingId(null);
    setFormName('');
    setFormCode('');
    setFormOrder(0);
    setErrorMsg(null);
    setIsAddingNew(false);
  };

  const createMutation = useMutation({
    mutationFn: gradeLevelsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grade-levels'] });
      resetForm();
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.message || 'حدث خطأ أثناء إضافة الصف الدراسي');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) =>
      gradeLevelsApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grade-levels'] });
      resetForm();
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.message || 'حدث خطأ أثناء تعديل الصف الدراسي');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: gradeLevelsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grade-levels'] });
      setErrorMsg(null);
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.message || 'حدث خطأ أثناء حذف الصف الدراسي');
    },
  });

  const startEdit = (item: GradeLevel) => {
    setEditingId(item.id);
    setFormName(item.name);
    setFormCode(item.code || '');
    setFormOrder(item.orderIndex);
    setIsAddingNew(false);
    setErrorMsg(null);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setErrorMsg('اسم الصف الدراسي مطلوب');
      return;
    }

    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        payload: {
          name: formName.trim(),
          code: formCode.trim() || undefined,
          orderIndex: Number(formOrder) || 0,
        },
      });
    } else {
      createMutation.mutate({
        name: formName.trim(),
        code: formCode.trim() || undefined,
        orderIndex: Number(formOrder) || 0,
      });
    }
  };

  const toggleStatus = (item: GradeLevel) => {
    updateMutation.mutate({
      id: item.id,
      payload: { isActive: !item.isActive },
    });
  };

  const handleDelete = (item: GradeLevel) => {
    if (confirm(`هل أنت متأكد من حذف (${item.name})؟`)) {
      deleteMutation.mutate(item.id);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(val) => {
        if (!val) resetForm();
        onOpenChange(val);
      }}
      title="إدارة الصفوف والمراحل الدراسية"
      description="إضافة وتعديل وترتيب وتفعيل الصفوف الدراسية لتظهر في جميع القوائم والتقارير"
      size="lg"
    >
      <div className="space-y-4">
        {errorMsg && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive">
            {errorMsg}
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">
            إجمالي الصفوف ({gradeLevels.length})
          </span>
          {!isAddingNew && !editingId && (
            <Button
              size="sm"
              onClick={() => {
                resetForm();
                setIsAddingNew(true);
                setFormOrder(gradeLevels.length + 1);
              }}
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" />
              <span>إضافة صف دراسي جديد</span>
            </Button>
          )}
        </div>

        {(isAddingNew || editingId) && (
          <form
            onSubmit={handleSave}
            className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-foreground">
                {editingId ? 'تعديل الصف الدراسي' : 'إضافة صف دراسي جديد'}
              </span>
              <button
                type="button"
                onClick={resetForm}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Input
                label="اسم الصف الدراسي *"
                placeholder="مثال: الصف الأول الثانوي"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
              />
              <Input
                label="الكود أو الاختصار"
                placeholder="مثال: SEC-1"
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
              />
              <Input
                label="الترتيب في القائمة"
                type="number"
                min={0}
                value={formOrder}
                onChange={(e) => setFormOrder(Number(e.target.value))}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={resetForm}>
                إلغاء
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="gap-1.5"
              >
                {createMutation.isPending || updateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                <span>{editingId ? 'حفظ التعديل' : 'إضافة الصف'}</span>
              </Button>
            </div>
          </form>
        )}

        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-right text-sm">
            <thead className="bg-muted/50 text-xs font-semibold text-muted-foreground border-b border-border">
              <tr>
                <th className="py-2.5 px-3">الترتيب</th>
                <th className="py-2.5 px-3">اسم الصف الدراسي</th>
                <th className="py-2.5 px-3">الكود</th>
                <th className="py-2.5 px-3">الحالة</th>
                <th className="py-2.5 px-3 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
                    <span>جاري تحميل الصفوف الدراسية...</span>
                  </td>
                </tr>
              ) : gradeLevels.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    <GraduationCap className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                    <span>لا توجد صفوف دراسية مسجلة حالياً</span>
                  </td>
                </tr>
              ) : (
                gradeLevels.map((item) => (
                  <tr key={item.id} className="hover:bg-accent/40 transition-colors">
                    <td className="py-2 px-3 font-mono text-xs text-muted-foreground">
                      {item.orderIndex}
                    </td>
                    <td className="py-2 px-3 font-medium text-foreground">
                      {item.name}
                    </td>
                    <td className="py-2 px-3 font-mono text-xs text-muted-foreground">
                      {item.code || '-'}
                    </td>
                    <td className="py-2 px-3">
                      <button
                        type="button"
                        onClick={() => toggleStatus(item)}
                        className="cursor-pointer"
                        title="انقر لتغيير حالة التفعيل"
                      >
                        <Badge variant={item.isActive ? 'success' : 'neutral'}>
                          {item.isActive ? 'مفعل' : 'معطل'}
                        </Badge>
                      </button>
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => startEdit(item)}
                          title="تعديل الصف"
                          className="h-8 w-8 text-muted-foreground hover:text-primary"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(item)}
                          disabled={deleteMutation.isPending}
                          title="حذف الصف"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}

