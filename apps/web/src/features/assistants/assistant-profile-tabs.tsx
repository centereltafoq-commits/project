import { Link } from 'react-router-dom';
import { AssistantCalculationMethod, PERMISSIONS } from '@edu-center/shared';
import { Badge, Card } from '@/design-system';
import { useAuth } from '@/features/auth/auth-context';
import { formatCurrency, formatDateAr, formatYearMonthAr } from '@/lib/formatters';
import { PAYMENT_METHOD_LABELS } from '../students/students.types';
import { ASSISTANT_CALC_METHOD_LABELS, AssistantProfileData } from './assistants.types';

export function AssistantMonthlyDuesTab({ data }: { data: AssistantProfileData }) {
  const { hasPermission } = useAuth();
  const canViewGroups = hasPermission(PERMISSIONS.GROUPS_VIEW);
  const { groupDues, baseGlobalDue, totalDues } = data.monthlyBreakdown;
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-right text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-xs font-bold text-muted-foreground">
              <th className="px-4 py-3">المجموعة</th>
              <th className="px-4 py-3">طريقة الاحتساب المطبقة</th>
              <th className="px-4 py-3">القيمة / النسبة</th>
              <th className="px-4 py-3">الحصص المنفذة</th>
              <th className="px-4 py-3">عدد الطلاب</th>
              <th className="px-4 py-3">المستحق</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {groupDues.length === 0 && baseGlobalDue === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  لا توجد مستحقات مسجلة لهذا الشهر
                </td>
              </tr>
            ) : (
              groupDues.map((d) => {
                const isPct =
                  d.calculationMethod === AssistantCalculationMethod.SESSION_COMMISSION_PERCENT;
                return (
                  <tr key={d.groupId} className="hover:bg-accent/30">
                    <td className="px-4 py-3 font-bold">
                      {canViewGroups ? (
                        <Link to={`/groups/${d.groupId}`} className="text-primary hover:underline">
                          {d.groupName}
                        </Link>
                      ) : (
                        <span>{d.groupName}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {ASSISTANT_CALC_METHOD_LABELS[
                        d.calculationMethod as AssistantCalculationMethod
                      ] ?? d.calculationMethod}
                    </td>
                    <td className="px-4 py-3">
                      {isPct ? `${d.rateValue}%` : formatCurrency(d.rateValue)}
                    </td>
                    <td className="px-4 py-3">{d.sessionsCount}</td>
                    <td className="px-4 py-3">{d.studentsCount}</td>
                    <td className="px-4 py-3 font-extrabold text-emerald-600">
                      {formatCurrency(d.amount)}
                    </td>
                  </tr>
                );
              })
            )}
            {baseGlobalDue > 0 && (
              <tr className="bg-muted/20">
                <td className="px-4 py-3 font-bold" colSpan={5}>
                  استحقاق شهري ثابت / اتفاق عام للمساعد
                </td>
                <td className="px-4 py-3 font-extrabold text-emerald-600">
                  {formatCurrency(baseGlobalDue)}
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-muted/40 font-extrabold">
              <td className="px-4 py-3" colSpan={5}>
                إجمالي مستحقات المساعد للشهر
              </td>
              <td className="px-4 py-3 text-emerald-600">{formatCurrency(totalDues)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}

export function AssistantLinkedGroupsTab({ data }: { data: AssistantProfileData }) {
  const { hasPermission } = useAuth();
  const canViewGroups = hasPermission(PERMISSIONS.GROUPS_VIEW);
  const canSeeRate =
    hasPermission(PERMISSIONS.FINANCE_VIEW) || hasPermission(PERMISSIONS.ASSISTANTS_MANAGE);
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-right text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-xs font-bold text-muted-foreground">
              <th className="px-4 py-3">المجموعة</th>
              <th className="px-4 py-3">المدرس الأساسي</th>
              <th className="px-4 py-3">الطلاب المشتركون</th>
              <th className="px-4 py-3">استثناء طريقة الاحتساب</th>
              <th className="px-4 py-3">الحالة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.linkedGroups.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  غير مرتبط بأي مجموعات حالياً (يمكن ربطه من إعدادات المجموعة)
                </td>
              </tr>
            ) : (
              data.linkedGroups.map((g) => (
                <tr key={g.linkId} className="hover:bg-accent/30">
                  <td className="px-4 py-3 font-bold">
                    {canViewGroups ? (
                      <Link to={`/groups/${g.groupId}`} className="text-primary hover:underline">
                        {g.groupName} ({g.groupCode})
                      </Link>
                    ) : (
                      <span>
                        {g.groupName} ({g.groupCode})
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">{g.teacherName}</td>
                  <td className="px-4 py-3">
                    <Badge variant="purple">{g.activeStudentsCount} طالب</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {g.overrideCalculationMethod
                      ? canSeeRate && g.overrideRateValue != null
                        ? `${ASSISTANT_CALC_METHOD_LABELS[g.overrideCalculationMethod]} (${formatCurrency(g.overrideRateValue)})`
                        : ASSISTANT_CALC_METHOD_LABELS[g.overrideCalculationMethod]
                      : 'حسب الإعداد الافتراضي للمساعد'}
                  </td>
                  <td className="px-4 py-3">
                    {g.isActive ? (
                      <Badge variant="success">نشطة</Badge>
                    ) : (
                      <Badge variant="neutral">متوقفة</Badge>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function AssistantPayoutsTab({ data }: { data: AssistantProfileData }) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-right text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-xs font-bold text-muted-foreground">
              <th className="px-4 py-3">رقم المرجع</th>
              <th className="px-4 py-3">الشهر المالي</th>
              <th className="px-4 py-3">المبلغ المنصرف</th>
              <th className="px-4 py-3">تاريخ الصرف</th>
              <th className="px-4 py-3">طريقة الصرف</th>
              <th className="px-4 py-3">ملاحظات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.payouts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  لا توجد عمليات صرف مسجلة للمساعد
                </td>
              </tr>
            ) : (
              data.payouts.map((p) => (
                <tr key={p.id} className="hover:bg-accent/30">
                  <td className="px-4 py-3 font-mono text-xs font-bold text-primary">
                    {p.referenceNumber}
                  </td>
                  <td className="px-4 py-3">{formatYearMonthAr(p.yearMonth)}</td>
                  <td className="px-4 py-3 font-extrabold text-emerald-600">
                    {formatCurrency(p.amount)}
                  </td>
                  <td className="px-4 py-3">{formatDateAr(p.payoutDate)}</td>
                  <td className="px-4 py-3">
                    <Badge variant="info">
                      {PAYMENT_METHOD_LABELS[p.paymentMethod] ?? p.paymentMethod}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{p.notes || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
