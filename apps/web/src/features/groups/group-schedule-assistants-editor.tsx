import { Plus, Trash2 } from 'lucide-react';
import { AssistantCalculationMethod } from '@edu-center/shared';
import { Button, Input, Select } from '@/design-system';
import { ARABIC_DAYS } from '@/lib/formatters';
import { ASSISTANT_CALC_METHOD_OPTIONS } from '../assistants/assistants.types';
import { GroupScheduleSlotItem } from './groups.types';

export interface AssistantDraftLink {
  assistantId: string;
  overrideCalculationMethod: string;
  overrideRateValue: string;
}

interface ScheduleAndAssistantsEditorProps {
  slots: GroupScheduleSlotItem[];
  onSlotsChange: (slots: GroupScheduleSlotItem[]) => void;
  assistantLinks: AssistantDraftLink[];
  onAssistantLinksChange: (links: AssistantDraftLink[]) => void;
  assistantOptions: Array<{
    value: string;
    label: string;
    calculationMethod?: string;
    rateValue?: string;
  }>;
}

export function GroupScheduleAssistantsEditor({
  slots,
  onSlotsChange,
  assistantLinks,
  onAssistantLinksChange,
  assistantOptions,
}: ScheduleAndAssistantsEditorProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-muted/20 p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-bold">مواعيد المجموعة الأسبوعية المقترحة (اختياري)</span>
            <p className="text-[11px] text-muted-foreground">
              يمكن تحديد الأيام والأوقات المبدئية هنا أو تنظيمها مباشرة عند تسكين المجموعة من شاشة إدارة القاعات
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              onSlotsChange([
                ...slots,
                { dayOfWeek: 6, startTime: '16:00', endTime: '18:00', classroomId: null },
              ])
            }
          >
            <Plus className="h-3.5 w-3.5" />
            إضافة موعد
          </Button>
        </div>
        {slots.length === 0 ? (
          <p className="text-xs text-muted-foreground">لم تتم إضافة مواعيد أسبوعية بعد (تُنظم عند التسكين في إدارة القاعات)</p>
        ) : (
          slots.map((slot, idx) => (
            <div key={idx} className="grid grid-cols-1 items-end gap-2 sm:grid-cols-4">
              <Select
                searchable
                label="اليوم"
                value={String(slot.dayOfWeek)}
                onChange={(e) =>
                  onSlotsChange(
                    slots.map((s, i) =>
                      i === idx ? { ...s, dayOfWeek: Number(e.target.value) } : s,
                    ),
                  )
                }
                options={ARABIC_DAYS.map((d, di) => ({ value: String(di), label: d }))}
              />
              <Input
                label="من"
                type="time"
                value={slot.startTime.slice(0, 5)}
                onChange={(e) =>
                  onSlotsChange(
                    slots.map((s, i) => (i === idx ? { ...s, startTime: e.target.value } : s)),
                  )
                }
              />
              <Input
                label="إلى"
                type="time"
                value={slot.endTime.slice(0, 5)}
                onChange={(e) =>
                  onSlotsChange(
                    slots.map((s, i) => (i === idx ? { ...s, endTime: e.target.value } : s)),
                  )
                }
              />
              <Button
                type="button"
                variant="danger"
                size="sm"
                className="h-10"
                onClick={() => onSlotsChange(slots.filter((_, i) => i !== idx))}
              >
                <Trash2 className="h-3.5 w-3.5" />
                حذف
              </Button>
            </div>
          ))
        )}
      </div>

      <div className="rounded-xl border border-border bg-muted/20 p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold">ربط المساعدين بالمجموعة (اختياري)</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={assistantOptions.length === 0}
            onClick={() =>
              onAssistantLinksChange([
                ...assistantLinks,
                {
                  assistantId: assistantOptions[0]?.value ?? '',
                  overrideCalculationMethod: '',
                  overrideRateValue: '',
                },
              ])
            }
          >
            <Plus className="h-3.5 w-3.5" />
            إضافة مساعد
          </Button>
        </div>
        {assistantLinks.map((lnk, idx) => {
          const baseAssistant = assistantOptions.find((a) => a.value === lnk.assistantId);
          const effectiveMethod = lnk.overrideCalculationMethod || baseAssistant?.calculationMethod;
          const isPercentOverride =
            effectiveMethod === AssistantCalculationMethod.SESSION_COMMISSION_PERCENT;
          return (
          <div key={idx} className="grid grid-cols-1 items-end gap-2 sm:grid-cols-4">
            <Select
              label="المساعد"
              searchable
              searchPlaceholder="ابحث باسم المساعد..."
              value={lnk.assistantId}
              onChange={(e) =>
                onAssistantLinksChange(
                  assistantLinks.map((a, i) =>
                    i === idx ? { ...a, assistantId: e.target.value } : a,
                  ),
                )
              }
              options={assistantOptions}
            />
            <Select
              searchable
              label="استثناء الطريقة"
              placeholder="الافتراضي للمساعد"
              value={lnk.overrideCalculationMethod}
              onChange={(e) =>
                onAssistantLinksChange(
                  assistantLinks.map((a, i) =>
                    i === idx
                      ? {
                          ...a,
                          overrideCalculationMethod: e.target.value as AssistantCalculationMethod,
                        }
                      : a,
                  ),
                )
              }
              options={ASSISTANT_CALC_METHOD_OPTIONS}
            />
            <Input
              label={isPercentOverride ? 'نسبة مخصصة (%)' : 'قيمة مخصصة'}
              type="number"
              step="0.01"
              min={0}
              max={isPercentOverride ? 100 : undefined}
              placeholder="افتراضي"
              value={lnk.overrideRateValue}
              onChange={(e) =>
                onAssistantLinksChange(
                  assistantLinks.map((a, i) =>
                    i === idx ? { ...a, overrideRateValue: e.target.value } : a,
                  ),
                )
              }
            />
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() =>
                onAssistantLinksChange(assistantLinks.filter((_, i) => i !== idx))
              }
            >
              <Trash2 className="h-3.5 w-3.5" />
              إزالة
            </Button>
          </div>
          );
        })}
      </div>
    </div>
  );
}
