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
          label="طريقة تقسيم العائد"
          value={values.revenueSplitMethod}
          onChange={(e) =>
            onChange({ revenueSplitMethod: e.target.value as GroupRevenueSplitMethod })
          }
          options={REVENUE_SPLIT_OPTIONS}
        />
        <Input
          label="نصيب المدرس عن الطالب (ج.م)"
          type="number"
          min={0}
          step="0.01"
          value={values.teacherSharePerStudent}
          onChange={(e) => onChange({ teacherSharePerStudent: e.target.value })}
        />
        <Input
          label="نصيب السنتر عن الطالب (ج.م)"
          type="number"
          min={0}
          step="0.01"
          value={values.centerSharePerStudent}
          onChange={(e) => onChange({ centerSharePerStudent: e.target.value })}
        />
        <Input
          label="نسبة المدرس المئوية (%)"
          type="number"
          min={0}
          max={100}
          step="0.01"
          value={values.teacherPercentage}
          onChange={(e) => onChange({ teacherPercentage: e.target.value })}
        />
        <Select
          label="سياسة غياب الشهر بالكامل"
          value={values.fullMonthAbsencePolicy}
          onChange={(e) =>
            onChange({ fullMonthAbsencePolicy: e.target.value as FullMonthAbsencePolicy })
          }
          options={FULL_ABSENCE_POLICY_OPTIONS}
        />
        <Input
          label="رسوم حجز مقعد عند الغياب الكامل"
          type="number"
          min={0}
          step="0.01"
          value={values.fullAbsenceFixedFee}
          onChange={(e) => onChange({ fullAbsenceFixedFee: e.target.value })}
        />
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
