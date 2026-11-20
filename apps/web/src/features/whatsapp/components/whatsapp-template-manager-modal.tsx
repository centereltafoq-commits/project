import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Edit3,
  Plus,
  RotateCcw,
  Save,
  Star,
  Trash2,
} from 'lucide-react';
import { Badge, Button, Input, Modal, Select, useToast } from '@/design-system';
import { extractErrorMessage } from '@/lib/api-client';
import { WHATSAPP_TEMPLATE_VARIABLES } from '@/lib/whatsapp.util';
import { whatsappTemplatesApi } from '../whatsapp.api';
import {
  WHATSAPP_CATEGORY_LABELS,
  WHATSAPP_CATEGORY_OPTIONS,
  WhatsappTemplateCategory,
  WhatsappTemplateItem,
} from '../whatsapp.types';

interface WhatsappTemplateManagerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: WhatsappTemplateItem[];
  canManage: boolean;
  onSelectTemplate?: (tpl: WhatsappTemplateItem) => void;
}

export function WhatsappTemplateManagerModal({
  open,
  onOpenChange,
  templates,
  canManage,
  onSelectTemplate,
}: WhatsappTemplateManagerModalProps) {
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [title, setTitle] = React.useState('');
  const [category, setCategory] = React.useState<WhatsappTemplateCategory>('GENERAL');
  const [content, setContent] = React.useState('');
  const [isDefault, setIsDefault] = React.useState(false);

  const resetForm = React.useCallback(() => {
    setEditingId(null);
    setTitle('');
    setCategory('GENERAL');
    setContent('');
    setIsDefault(false);
  }, []);

  React.useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open, resetForm]);

  const invalidateTemplates = () =>
    queryClient.invalidateQueries({ queryKey: ['whatsapp-templates'] });

  const createMutation = useMutation({
    mutationFn: whatsappTemplatesApi.create,
    onSuccess: (created) => {
      invalidateTemplates();
      onSelectTemplate?.(created);
      resetForm();
      notify('تمت إضافة قالب الرسالة بنجاح', 'success');
    },
    onError: (err) => notify(extractErrorMessage(err), 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof whatsappTemplatesApi.update>[1] }) =>
      whatsappTemplatesApi.update(id, payload),
    onSuccess: (updated) => {
      invalidateTemplates();
      onSelectTemplate?.(updated);
      resetForm();
      notify('تم تحديث القالب بنجاح', 'success');
    },
    onError: (err) => notify(extractErrorMessage(err), 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: whatsappTemplatesApi.remove,
    onSuccess: () => {
      invalidateTemplates();
      if (editingId) {
        resetForm();
      }
      notify('تم حذف القالب', 'success');
    },
    onError: (err) => notify(extractErrorMessage(err), 'error'),
  });

  const resetMutation = useMutation({
    mutationFn: whatsappTemplatesApi.resetDefaults,
    onSuccess: (restored) => {
      invalidateTemplates();
      if (restored[0]) {
        onSelectTemplate?.(restored[0]);
      }
      resetForm();
      notify('تمت استعادة القوالب الافتراضية بنجاح', 'success');
    },
    onError: (err) => notify(extractErrorMessage(err), 'error'),
  });

  const startEdit = (tpl: WhatsappTemplateItem) => {
    setEditingId(tpl.id);
    setTitle(tpl.title);
    setCategory(tpl.category);
    setContent(tpl.content);
    setIsDefault(tpl.isDefault);
  };

  const insertToken = (token: string) => {
    const el = textareaRef.current;
    if (!el) {
      setContent((prev) => `${prev}${prev && !prev.endsWith(' ') ? ' ' : ''}${token}`);
      return;
    }
    const start = el.selectionStart ?? content.length;
    const end = el.selectionEnd ?? content.length;
    const next = `${content.slice(0, start)}${token}${content.slice(end)}`;
    setContent(next);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    }, 0);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;
    if (title.trim().length < 2 || content.trim().length < 2) {
      notify('يرجى إدخال عنوان القالب ونص الرسالة', 'error');
      return;
    }

    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        payload: {
          title: title.trim(),
          category,
          content: content.trim(),
          isDefault,
        },
      });
      return;
    }

    createMutation.mutate({
      title: title.trim(),
      category,
      content: content.trim(),
      isDefault,
    });
  };

  const isBusy =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending ||
    resetMutation.isPending;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="إدارة قوالب رسائل واتساب التلقائية"
      description="أضف أو عدّل قوالب الرسائل المحفوظة لاستخدامها فوراً مع المتغيرات التلقائية"
    >
      <div className="space-y-4">
        {canManage && (
          <form
            onSubmit={handleSubmit}
            className="space-y-3 rounded-xl border border-border bg-muted/20 p-3.5"
          >
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-black text-foreground">
                {editingId ? 'تعديل القالب المحدد' : 'إضافة قالب جديد'}
              </h4>
              {editingId && (
                <Button type="button" size="sm" variant="ghost" onClick={resetForm}>
                  إلغاء التعديل
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="عنوان القالب"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثال: تذكير بموعد المراجعة"
                maxLength={80}
                required
              />
              <Select
                label="التصنيف"
                value={category}
                onChange={(e) => setCategory(e.target.value as WhatsappTemplateCategory)}
                options={WHATSAPP_CATEGORY_OPTIONS}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-foreground">
                نص الرسالة التلقائية
              </label>
              <textarea
                ref={textareaRef}
                rows={4}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="اكتب نص القالب هنا..."
                maxLength={2000}
                className="w-full rounded-lg border border-input bg-card px-3 py-2 text-xs leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                required
              />
              <div className="flex flex-wrap items-center gap-1">
                {WHATSAPP_TEMPLATE_VARIABLES.map((v) => (
                  <button
                    key={v.token}
                    type="button"
                    onClick={() => insertToken(v.token)}
                    className="rounded-md border border-border bg-card px-2 py-0.5 text-[10px] font-bold text-primary hover:bg-primary/10"
                  >
                    + {v.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-foreground select-none">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                <span>تعيين كقالب افتراضي عند فتح الصفحة</span>
              </label>

              <Button type="submit" size="sm" isLoading={isBusy} className="gap-1.5 font-bold">
                {editingId ? <Save className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                <span>{editingId ? 'حفظ التعديلات' : 'إضافة القالب'}</span>
              </Button>
            </div>
          </form>
        )}

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-xs font-black text-foreground">
              القوالب المحفوظة ({templates.length})
            </h4>
            {canManage && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isBusy}
                onClick={() => resetMutation.mutate()}
                className="h-7 gap-1 px-2.5 text-[11px]"
              >
                <RotateCcw className="h-3 w-3" />
                استعادة الافتراضية
              </Button>
            )}
          </div>

          <div className="max-h-60 overflow-y-auto rounded-xl border border-border bg-card divide-y divide-border">
            {templates.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                لا توجد قوالب محفوظة حالياً
              </div>
            ) : (
              templates.map((tpl) => (
                <div
                  key={tpl.id}
                  className="flex items-start justify-between gap-3 px-3.5 py-2.5 text-xs hover:bg-muted/20"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-bold text-foreground">{tpl.title}</span>
                      <Badge variant="info" className="text-[10px]">
                        {WHATSAPP_CATEGORY_LABELS[tpl.category] ?? tpl.category}
                      </Badge>
                      {tpl.isDefault && (
                        <Badge variant="success" className="gap-0.5 text-[10px]">
                          <Star className="h-2.5 w-2.5" />
                          الافتراضي
                        </Badge>
                      )}
                    </div>
                    <p className="line-clamp-2 whitespace-pre-line text-[11px] text-muted-foreground">
                      {tpl.content}
                    </p>
                  </div>

                  {canManage && (
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={isBusy}
                        onClick={() => startEdit(tpl)}
                        aria-label={`تعديل ${tpl.title}`}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={isBusy}
                        onClick={() => deleteMutation.mutate(tpl.id)}
                        aria-label={`حذف ${tpl.title}`}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex justify-end border-t border-border pt-3">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            إغلاق
          </Button>
        </div>
      </div>
    </Modal>
  );
}
