import { Link } from 'react-router-dom';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/design-system';
import { ARABIC_DAYS, formatCurrency, formatTimeRangeAr } from '@/lib/formatters';
import { SPLIT_METHOD_LABELS, TeacherProfileData } from './teachers.types';
export { TeacherBookingsTab, TeacherPayoutsTab } from './teacher-payouts-bookings-tabs';

export function TeacherMonthlySummaryTab({ data }: { data: TeacherProfileData }) {
  const { groups, totals } = data.monthlyBreakdown;
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-right text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-xs font-bold text-muted-foreground">
              <th className="px-4 py-3">المجموعة</th>
              <th className="px-4 py-3">طريقة التقسيم</th>
              <th className="px-4 py-3">الحصص المنفذة</th>
              <th className="px-4 py-3">عدد الطلاب</th>
              <th className="px-4 py-3">إجمالي عائد المجموعة</th>
              <th className="px-4 py-3">نصيب المدرس</th>
              <th className="px-4 py-3">نصيب السنتر</th>
              <th className="px-4 py-3">الحالة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {groups.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  لا توجد مجموعات أو مستحقات مسجلة لهذا الشهر
                </td>
              </tr>
            ) : (
              groups.map((g) => (
                <tr key={g.groupId} className="hover:bg-accent/30">
                  <td className="px-4 py-3 font-bold">
                    <Link to={`/groups/${g.groupId}`} className="text-primary hover:underline">
                      {g.groupName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {SPLIT_METHOD_LABELS[g.revenueSplitMethod] ?? g.revenueSplitMethod}
                  </td>
                  <td className="px-4 py-3 font-semibold">{g.executedSessionsCount}</td>
                  <td className="px-4 py-3">{g.studentsCount}</td>
                  <td className="px-4 py-3">{formatCurrency(g.grossRevenue)}</td>
                  <td className="px-4 py-3 font-extrabold text-emerald-600">
                    {formatCurrency(g.teacherShare)}
                  </td>
                  <td className="px-4 py-3 font-semibold text-primary">
                    {formatCurrency(g.centerShare)}
                  </td>
                  <td className="px-4 py-3">
                    {g.isLocked ? (
                      <Badge variant="neutral">مقفل</Badge>
                    ) : (
                      <Badge variant="info">تراكمي مباشر</Badge>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {groups.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-border bg-muted/40 font-extrabold">
                <td className="px-4 py-3" colSpan={2}>
                  الإجمالي الشهري
                </td>
                <td className="px-4 py-3">{totals.executedSessionsCount}</td>
                <td className="px-4 py-3">—</td>
                <td className="px-4 py-3">—</td>
                <td className="px-4 py-3 text-emerald-600">
                  {formatCurrency(totals.totalDues)}
                </td>
                <td className="px-4 py-3" colSpan={2}>
                  المنصرف: {formatCurrency(totals.totalPayouts)} • المتبقي:{' '}
                  {formatCurrency(totals.remainingBalance)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </Card>
  );
}

export function TeacherGroupsAndScheduleTab({ data }: { data: TeacherProfileData }) {
  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>المجموعات المسندة للمدرس</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-right text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-xs font-bold text-muted-foreground">
                <th className="px-4 py-3">الكود والاسم</th>
                <th className="px-4 py-3">المادة والصف</th>
                <th className="px-4 py-3">القاعة</th>
                <th className="px-4 py-3">الطلاب المشتركون</th>
                <th className="px-4 py-3">الاشتراك الشهري</th>
                <th className="px-4 py-3">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.assignedGroups.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    لا توجد مجموعات مسندة حالياً
                  </td>
                </tr>
              ) : (
                data.assignedGroups.map((g) => (
                  <tr key={g.id} className="hover:bg-accent/30">
                    <td className="px-4 py-3 font-bold">
                      <Link to={`/groups/${g.id}`} className="text-primary hover:underline">
                        {g.name} ({g.groupCode})
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {g.subject} - {g.gradeLevel}
                    </td>
                    <td className="px-4 py-3">{g.classroomName || '—'}</td>
                    <td className="px-4 py-3">
                      <Badge variant="purple">
                        {g.activeStudentsCount} / {g.maxStudents} طالب
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-semibold">{formatCurrency(g.monthlyPrice)}</td>
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

      <Card>
        <CardHeader>
          <CardTitle>الجدول الأسبوعي الثابت للمدرس</CardTitle>
        </CardHeader>
        <CardContent>
          {data.scheduleSlots.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا توجد مواعيد مجدولة في المجموعات</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.scheduleSlots.map((s, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-border bg-muted/25 p-3 text-sm"
                >
                  <div className="flex items-center justify-between">
                    <Badge variant="info">{ARABIC_DAYS[s.dayOfWeek]}</Badge>
                    <span className="font-semibold text-xs text-muted-foreground">
                      {formatTimeRangeAr(s.startTime, s.endTime)}
                    </span>
                  </div>
                  <p className="mt-2 font-bold text-foreground">{s.groupName}</p>
                  <p className="text-xs text-muted-foreground">
                    القاعة: {s.classroomName || 'غير محددة'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
