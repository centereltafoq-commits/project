import { FullMonthAbsencePolicy, GroupRevenueSplitMethod } from '@edu-center/shared';
import { Input, Select } from '@/design-system';
import { formatCurrency } from '@/lib/formatters';
import { FULL_ABSENCE_POLICY_OPTIONS, REVENUE_SPLIT_OPTIONS } from './groups.types';

export interface GroupPolicyFormState {
  monthlySessionsCount: string;
  monthlyPrice: string;
  revenueSplitMethod: GroupRevenueSplitMethod;
  teacherSharePerStudent: string;
  centerSharePerStudent: string;
  teacherPercentage: string;
  fullMonthAbsencePolicy: FullMonthAbsencePolicy;
  fullAbsenceFixedFee: string;
  chargeExcusedAbsence: boolean;
}

interface GroupFinancialPolicyFieldsProps {
  values: GroupPolicyFormState;
  onChange: (patch: Partial<GroupPolicyFormState>) => void;
}

export function GroupFinancialPolicyFields({
  values,
  onChange,
}: GroupFinancialPolicyFieldsProps) {
  const computedSessionPrice =
    Number(values.monthlySessionsCount) > 0
      ? Number(values.monthlyPrice || 0) / Number(values.monthlySessionsCount)
      : 0;

  const isCustomPercentage =
    values.revenueSplitMethod === GroupRevenueSplitMethod.CUSTOM_PERCENTAGE;
  const isFixedPerSession =
    values.revenueSplitMethod === GroupRevenueSplitMethod.FIXED_PER_SESSION;
  const isFixedAbsenceFee =
    values.fullMonthAbsencePolicy === FullMonthAbsencePolicy.CHARGE_FIXED_RESERVATION_FEE;

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-extrabold text-foreground">
          السياسة المالية وتقسيم العائد الشهري
        </h4>
        <span className="text-xs font-bold text-primary">
          سعر الحصة الواحدة المحسوب تلقائياً: {formatCurrency(computedSessionPrice)}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Input
          label="عدد الحصص الشهرية"
          type="number"
          min={1}
          required
          value={values.monthlySessionsCount}
          onChange={(e) => onChange({ monthlySessionsCount: e.target.value })}
        />
        <Input
          label="الاشتراك الشهري للطالب (ج.م)"
          type="number"
          min={0}
          step="0.01"
          required
          value={values.monthlyPrice}
          onChange={(e) => onChange({ monthlyPrice: e.target.value })}
        />
        <Select
          searchable
          required
          label="طريقة تقسيم العائد"
          value={values.revenueSplitMethod}
          onChange={(e) =>
            onChange({ revenueSplitMethod: e.target.value as GroupRevenueSplitMethod })
          }
          options={REVENUE_SPLIT_OPTIONS}
        />

        {isCustomPercentage ? (
          <div className="sm:col-span-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="نسبة المدرس المئوية (%)"
              type="number"
              min={0}
              max={100}
              step="0.01"
              required
              value={values.teacherPercentage}
              onChange={(e) => onChange({ teacherPercentage: e.target.value })}
            />
            <div className="flex items-end">
              <div className="flex h-9 w-full items-center justify-between rounded-lg border border-border bg-card px-3 text-xs">
                <span className="text-muted-foreground">نسبة السنتر المتبقية:</span>
                <strong className="font-bold text-foreground">
                  {Math.max(0, Math.min(100, 100 - Number(values.teacherPercentage || 0))).toFixed(2)}%
                </strong>
              </div>
            </div>
          </div>
        ) : isFixedPerSession ? (
          <div className="sm:col-span-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="أجر المدرس الثابت عن كل حصة منفذة (ج.م)"
              type="number"
              min={0}
              step="0.01"
              required
              value={values.teacherSharePerStudent}
              onChange={(e) => onChange({ teacherSharePerStudent: e.target.value })}
            />
            <div className="flex items-end">
              <div className="flex h-9 w-full items-center rounded-lg border border-border bg-card px-3 text-xs text-muted-foreground">
                يحصل السنتر تلقائياً على ما تبقى من إجمالي إيراد المجموعة الشهري.
              </div>
            </div>
          </div>
        ) : (
          <>
            <Input
              label="نصيب المدرس عن الطالب (ج.م)"
              type="number"
              min={0}
              step="0.01"
              required
              value={values.teacherSharePerStudent}
              onChange={(e) => onChange({ teacherSharePerStudent: e.target.value })}
            />
            <Input
              label="نصيب السنتر عن الطالب (ج.م)"
              type="number"
              min={0}
              step="0.01"
              required
              value={values.centerSharePerStudent}
              onChange={(e) => onChange({ centerSharePerStudent: e.target.value })}
            />
            <div className="flex items-end">
              <div className="flex h-9 w-full items-center justify-between rounded-lg border border-border bg-card px-3 text-xs">
                <span className="text-muted-foreground">مجموع الحصتين:</span>
                <strong className="font-bold text-foreground">
                  {formatCurrency(
                    Number(values.teacherSharePerStudent || 0) +
                      Number(values.centerSharePerStudent || 0),
                  )}
                </strong>
              </div>
            </div>
          </>
        )}

        <Select
          searchable
          required
          label="سياسة غياب الشهر بالكامل"
          value={values.fullMonthAbsencePolicy}
          onChange={(e) =>
            onChange({ fullMonthAbsencePolicy: e.target.value as FullMonthAbsencePolicy })
          }
          options={FULL_ABSENCE_POLICY_OPTIONS}
        />
        {isFixedAbsenceFee && (
          <Input
            label="رسوم حجز مقعد عند الغياب الكامل"
            type="number"
            min={0}
            step="0.01"
            value={values.fullAbsenceFixedFee}
            onChange={(e) => onChange({ fullAbsenceFixedFee: e.target.value })}
          />
        )}
        <label className="flex h-10 cursor-pointer items-center gap-2 self-end text-xs font-bold">
          <input
            type="checkbox"
            checked={values.chargeExcusedAbsence}
            onChange={(e) => onChange({ chargeExcusedAbsence: e.target.checked })}
            className="h-4 w-4"
          />
          احتساب الحصة في الغياب بعذر
        </label>
      </div>
    </div>
  );
}
