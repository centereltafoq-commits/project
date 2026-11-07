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
  assistantOptions: Array<{ value: string; label: string }>;
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
          <span className="text-sm font-bold">مواعيد المجموعة الأسبوعية</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              onSlotsChange([...slots, { dayOfWeek: 6, startTime: '16:00', endTime: '18:00' }])
            }
          >
            <Plus className="h-3.5 w-3.5" />
            إضافة موعد
          </Button>
        </div>
        {slots.length === 0 ? (
          <p className="text-xs text-muted-foreground">لم تتم إضافة مواعيد أسبوعية بعد</p>
        ) : (
          slots.map((slot, idx) => (
            <div key={idx} className="grid grid-cols-1 items-end gap-2 sm:grid-cols-4">
              <Select
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
                value={slot.startTime}
                onChange={(e) =>
                  onSlotsChange(
                    slots.map((s, i) => (i === idx ? { ...s, startTime: e.target.value } : s)),
                  )
                }
              />
              <Input
                label="إلى"
                type="time"
                value={slot.endTime}
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
        {assistantLinks.map((lnk, idx) => (
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
              label="قيمة مخصصة"
              type="number"
              step="0.01"
              min={0}
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
        ))}
      </div>
    </div>
  );
}
