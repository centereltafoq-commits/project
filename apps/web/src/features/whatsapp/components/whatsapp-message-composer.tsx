import * as React from 'react';
import {
  BookmarkPlus,
  Eraser,
  ExternalLink,
  FileText,
  Globe,
  MessageSquarePlus,
  Save,
  Settings2,
  Sparkles,
} from 'lucide-react';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Select } from '@/design-system';
import {
  WHATSAPP_TEMPLATE_VARIABLES,
  WhatsappLaunchMode,
  WhatsappTemplateVariables,
  renderWhatsAppTemplate,
} from '@/lib/whatsapp.util';
import {
  CreateWhatsappTemplatePayload,
  WHATSAPP_CATEGORY_LABELS,
  WHATSAPP_CATEGORY_OPTIONS,
  WhatsappMessageMode,
  WhatsappTemplateCategory,
  WhatsappTemplateItem,
} from '../whatsapp.types';

interface WhatsappMessageComposerProps {
  templates: WhatsappTemplateItem[];
  isLoadingTemplates: boolean;
  messageMode: WhatsappMessageMode;
  onChangeMessageMode: (mode: WhatsappMessageMode) => void;
  selectedTemplateId: string;
  onSelectTemplate: (template: WhatsappTemplateItem) => void;
  messageText: string;
  onChangeMessageText: (value: string) => void;
  launchMode: WhatsappLaunchMode;
  onChangeLaunchMode: (mode: WhatsappLaunchMode) => void;
  previewVars: WhatsappTemplateVariables;
  canManageTemplates: boolean;
  onSaveTemplateEdit: (id: string, content: string) => void;
  isSavingTemplate: boolean;
  onCreateTemplate: (payload: CreateWhatsappTemplatePayload) => void;
  isCreatingTemplate: boolean;
  onOpenTemplateManager: () => void;
}

export function WhatsappMessageComposer({
  templates,
  isLoadingTemplates,
  messageMode,
  onChangeMessageMode,
  selectedTemplateId,
  onSelectTemplate,
  messageText,
  onChangeMessageText,
  launchMode,
  onChangeLaunchMode,
  previewVars,
  canManageTemplates,
  onSaveTemplateEdit,
  isSavingTemplate,
  onCreateTemplate,
  isCreatingTemplate,
  onOpenTemplateManager,
}: WhatsappMessageComposerProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const [categoryFilter, setCategoryFilter] = React.useState<'ALL' | WhatsappTemplateCategory>('ALL');
  const [showSaveNewForm, setShowSaveNewForm] = React.useState(false);
  const [newTitle, setNewTitle] = React.useState('');
  const [newCategory, setNewCategory] = React.useState<WhatsappTemplateCategory>('GENERAL');

  const filteredTemplates = React.useMemo(() => {
    if (categoryFilter === 'ALL') return templates;
    return templates.filter((t) => t.category === categoryFilter);
  }, [templates, categoryFilter]);

  const selectedTemplate = React.useMemo(
    () => templates.find((t) => t.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId],
  );

  const isDirtyTemplate =
    messageMode === 'template' &&
    Boolean(selectedTemplate) &&
    messageText.trim() !== (selectedTemplate?.content ?? '').trim();

  const templateOptions = React.useMemo(
    () =>
      filteredTemplates.map((t) => ({
        value: t.id,
        label: t.isDefault ? `${t.title} ★` : t.title,
      })),
    [filteredTemplates],
  );

  const insertVariable = (token: string) => {
    const el = textareaRef.current;
    if (!el) {
      onChangeMessageText(
        `${messageText}${messageText && !messageText.endsWith(' ') ? ' ' : ''}${token}`,
      );
      return;
    }
    const start = el.selectionStart ?? messageText.length;
    const end = el.selectionEnd ?? messageText.length;
    const next = `${messageText.slice(0, start)}${token}${messageText.slice(end)}`;
    onChangeMessageText(next);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    }, 0);
  };

  const renderedPreview = React.useMemo(
    () => renderWhatsAppTemplate(messageText, previewVars),
    [messageText, previewVars],
  );

  const handleSaveNewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !messageText.trim()) return;
    onCreateTemplate({
      title: newTitle.trim(),
      category: newCategory,
      content: messageText.trim(),
    });
    setNewTitle('');
    setShowSaveNewForm(false);
  };

  return (
    <Card>
      <CardHeader className="space-y-3 border-b border-border pb-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4.5 w-4.5 text-primary" />
            محتوى الرسالة والقوالب التلقائية
          </CardTitle>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onOpenTemplateManager}
            className="h-8 gap-1.5 text-xs font-bold"
          >
            <Settings2 className="h-3.5 w-3.5" />
            إدارة القوالب
          </Button>
        </div>

        {/* التبديل بين رسالة محفوظة / رسالة مرة واحدة */}
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/40 p-1">
          <button
            type="button"
            onClick={() => onChangeMessageMode('template')}
            className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-all ${
              messageMode === 'template'
                ? 'bg-card text-primary shadow-xs ring-1 ring-border'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>رسالة محفوظة (قالب تلقائي)</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeMessageMode('one-time')}
            className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-all ${
              messageMode === 'one-time'
                ? 'bg-card text-amber-600 dark:text-amber-400 shadow-xs ring-1 ring-border'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <MessageSquarePlus className="h-3.5 w-3.5" />
            <span>رسالة مرة واحدة (بدون حفظ)</span>
          </button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-4">
        {messageMode === 'template' ? (
          <div className="space-y-3">
            {/* فلتر التصنيف */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCategoryFilter('ALL')}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors ${
                  categoryFilter === 'ALL'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                كل القوالب ({templates.length})
              </button>
              {WHATSAPP_CATEGORY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setCategoryFilter(opt.value)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors ${
                    categoryFilter === opt.value
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {WHATSAPP_CATEGORY_LABELS[opt.value]}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-end gap-2">
              <Select
                containerClassName="flex-1 min-w-[220px]"
                label="اختر الرسالة التلقائية"
                placeholder={isLoadingTemplates ? 'جاري تحميل القوالب...' : 'اختر قالب رسالة...'}
                value={selectedTemplateId}
                onChange={(e) => {
                  const found = templates.find((t) => t.id === e.target.value);
                  if (found) onSelectTemplate(found);
                }}
                options={templateOptions}
                disabled={isLoadingTemplates || filteredTemplates.length === 0}
              />

              {canManageTemplates && (
                <div className="flex items-center gap-1.5">
                  {isDirtyTemplate && selectedTemplate && (
                    <Button
                      type="button"
                      size="sm"
                      variant="primary"
                      isLoading={isSavingTemplate}
                      onClick={() => onSaveTemplateEdit(selectedTemplate.id, messageText)}
                      className="h-9 gap-1.5 text-xs font-bold"
                    >
                      <Save className="h-3.5 w-3.5" />
                      حفظ التعديلات
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setShowSaveNewForm((v) => !v)}
                    className="h-9 gap-1.5 text-xs font-bold"
                  >
                    <BookmarkPlus className="h-3.5 w-3.5" />
                    حفظ كقالب جديد
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs">
            <span className="font-bold text-amber-800 dark:text-amber-300">
              وضع الرسالة الفورية — تُكتب للإرسال الآن ولن تُحفظ في قوالب النظام
            </span>
            <div className="flex items-center gap-1.5">
              {canManageTemplates && messageText.trim().length >= 2 && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowSaveNewForm((v) => !v)}
                  className="h-7 gap-1 px-2 text-[11px] font-bold"
                >
                  <BookmarkPlus className="h-3 w-3" />
                  حفظ كقالب
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onChangeMessageText('')}
                className="h-7 gap-1 px-2 text-[11px]"
              >
                <Eraser className="h-3 w-3" />
                مسح النص
              </Button>
            </div>
          </div>
        )}

        {showSaveNewForm && canManageTemplates && (
          <form
            onSubmit={handleSaveNewSubmit}
            className="grid grid-cols-1 gap-2 rounded-xl border border-primary/25 bg-primary/5 p-3 sm:grid-cols-12 sm:items-end"
          >
            <div className="sm:col-span-5">
              <Input
                label="اسم القالب الجديد"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="مثال: تنويه مراجعة نهائية"
                required
              />
            </div>
            <div className="sm:col-span-4">
              <Select
                label="التصنيف"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as WhatsappTemplateCategory)}
                options={WHATSAPP_CATEGORY_OPTIONS}
              />
            </div>
            <div className="flex gap-1.5 sm:col-span-3">
              <Button
                type="submit"
                size="sm"
                isLoading={isCreatingTemplate}
                className="h-9 flex-1 font-bold"
              >
                حفظ
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setShowSaveNewForm(false)}
                className="h-9"
              >
                إلغاء
              </Button>
            </div>
          </form>
        )}

        {/* محرر الرسالة */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="whatsapp-message-editor" className="text-xs font-bold text-foreground">
              نص الرسالة القابل للتعديل
            </label>
            <Badge variant="neutral" className="font-mono text-[10px]">
              {messageText.length} / 2000 حرف
            </Badge>
          </div>

          <textarea
            id="whatsapp-message-editor"
            ref={textareaRef}
            rows={5}
            value={messageText}
            onChange={(e) => onChangeMessageText(e.target.value)}
            placeholder="اكتب نص الرسالة هنا أو اختر قالباً جاهزاً من الأعلى..."
            maxLength={2000}
            className="w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />

          <div className="space-y-1">
            <span className="block text-[11px] font-semibold text-muted-foreground">
              إدراج متغير تلقائي (يتبدل حسب بيانات كل طالب تلقائياً):
            </span>
            <div className="flex flex-wrap gap-1.5">
              {WHATSAPP_TEMPLATE_VARIABLES.map((v) => (
                <button
                  key={v.token}
                  type="button"
                  onClick={() => insertVariable(v.token)}
                  className="rounded-lg border border-border bg-muted/30 px-2.5 py-1 text-[11px] font-bold text-primary transition-colors hover:border-primary/40 hover:bg-primary/10"
                >
                  + {v.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* طريقة الفتح */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-muted/15 px-3.5 py-2.5">
          <span className="text-xs font-bold text-foreground">طريقة فتح واتساب:</span>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => onChangeLaunchMode('web')}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold transition-colors ${
                launchMode === 'web'
                  ? 'border-emerald-600 bg-emerald-600 text-white'
                  : 'border-border bg-card text-muted-foreground hover:text-foreground'
              }`}
            >
              <Globe className="h-3.5 w-3.5" />
              WhatsApp Web (نافذة ويب مدمجة)
            </button>
            <button
              type="button"
              onClick={() => onChangeLaunchMode('app')}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold transition-colors ${
                launchMode === 'app'
                  ? 'border-emerald-600 bg-emerald-600 text-white'
                  : 'border-border bg-card text-muted-foreground hover:text-foreground'
              }`}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              رابط wa.me (التطبيق)
            </button>
          </div>
        </div>

        {/* معاينة الرسالة النهائية */}
        <div className="space-y-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] p-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-black text-emerald-800 dark:text-emerald-300">
              معاينة الرسالة النهائية كما ستصل للطالب:
            </span>
            {previewVars.studentName && (
              <Badge variant="success" className="text-[10px]">
                {previewVars.studentName}
              </Badge>
            )}
          </div>
          <p className="min-h-[3.5rem] whitespace-pre-wrap rounded-lg border border-emerald-500/20 bg-card/90 p-3 text-xs leading-relaxed text-foreground">
            {renderedPreview || 'سيظهر هنا نص الرسالة النهائي بعد تعبئة المتغيرات...'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
