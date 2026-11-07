import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, BookOpen, CreditCard, Edit3, Phone, Wallet } from 'lucide-react';
import { AssistantCalculationMethod } from '@edu-center/shared';
import {
  Badge,
  Button,
  Card,
  Input,
  PageHeader,
  StatCard,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/design-system';
import { apiClient } from '@/lib/api-client';
import { formatCurrency, formatYearMonthAr, getCurrentYearMonth } from '@/lib/formatters';
import { AssistantFormModal } from './assistant-form-modal';
import {
  AssistantLinkedGroupsTab,
  AssistantMonthlyDuesTab,
  AssistantPayoutsTab,
} from './assistant-profile-tabs';
import { ASSISTANT_CALC_METHOD_LABELS, AssistantProfileData } from './assistants.types';

export function AssistantProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [yearMonth, setYearMonth] = React.useState(getCurrentYearMonth());
  const [editOpen, setEditOpen] = React.useState(false);

  const { data, isLoading } = useQuery<AssistantProfileData>({
    queryKey: ['assistant-profile', id, yearMonth],
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await apiClient.get(`/assistants/${id}/profile`, {
        params: { yearMonth },
      });
      return res.data;
    },
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <div className="h-24 animate-pulse rounded-xl bg-muted" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  const { assistant, monthlyBreakdown } = data;
  const isPct =
    assistant.calculationMethod === AssistantCalculationMethod.SESSION_COMMISSION_PERCENT;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`ملف المساعد: ${assistant.fullName}`}
        description={`الكود: ${assistant.assistantCode} • ${ASSISTANT_CALC_METHOD_LABELS[assistant.calculationMethod]}`}
        actions={
          <>
            <Input
              type="month"
              value={yearMonth}
              onChange={(e) => e.target.value && setYearMonth(e.target.value)}
              className="w-44"
            />
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Edit3 className="h-4 w-4" />
              تعديل البيانات
            </Button>
            <Button variant="ghost" onClick={() => navigate('/assistants')}>
              <ArrowRight className="h-4 w-4" />
              قائمة المساعدين
            </Button>
          </>
        }
      />

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <span className="text-muted-foreground">الحالة: </span>
              <Badge variant={assistant.status === 'ACTIVE' ? 'success' : 'danger'}>
                {assistant.status === 'ACTIVE' ? 'نشط' : 'متوقف'}
              </Badge>
            </div>
            <div className="flex items-center gap-1.5">
              <Phone className="h-4 w-4 text-primary" />
              <span className="text-muted-foreground">الهاتف:</span>
              <strong dir="ltr">{assistant.phone}</strong>
            </div>
            <div>
              <span className="text-muted-foreground">المعدل الافتراضي: </span>
              <strong>
                {isPct ? `${Number(assistant.rateValue)}%` : formatCurrency(assistant.rateValue)}
              </strong>
            </div>
            {assistant.customFormulaNote && (
              <div>
                <span className="text-muted-foreground">ملاحظة الاتفاق: </span>
                <span>{assistant.customFormulaNote}</span>
              </div>
            )}
          </div>
          <Badge variant="purple">شهر {formatYearMonthAr(yearMonth)}</Badge>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="مستحقات الشهر"
          value={formatCurrency(monthlyBreakdown.totalDues)}
          subtitle={`عن ${formatYearMonthAr(yearMonth)}`}
          icon={Wallet}
          tone="purple"
        />
        <StatCard
          title="المنصرف في الشهر"
          value={formatCurrency(monthlyBreakdown.totalPayouts)}
          subtitle="دفعات مسجلة"
          icon={CreditCard}
          tone="success"
        />
        <StatCard
          title="الرصيد المتبقي"
          value={formatCurrency(monthlyBreakdown.remainingBalance)}
          subtitle={monthlyBreakdown.remainingBalance > 0 ? 'مستحق الصرف' : 'تمت التصفية'}
          icon={Wallet}
          tone={monthlyBreakdown.remainingBalance > 0 ? 'warning' : 'success'}
        />
      </div>

      <Tabs defaultValue="dues">
        <TabsList>
          <TabsTrigger value="dues">
            <Wallet className="h-4 w-4" />
            تفاصيل المستحقات الشهرية
          </TabsTrigger>
          <TabsTrigger value="groups">
            <BookOpen className="h-4 w-4" />
            المجموعات المرتبطة ({data.linkedGroups.length})
          </TabsTrigger>
          <TabsTrigger value="payouts">
            <CreditCard className="h-4 w-4" />
            عمليات الصرف ({data.payouts.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dues">
          <AssistantMonthlyDuesTab data={data} />
        </TabsContent>
        <TabsContent value="groups">
          <AssistantLinkedGroupsTab data={data} />
        </TabsContent>
        <TabsContent value="payouts">
          <AssistantPayoutsTab data={data} />
        </TabsContent>
      </Tabs>

      <AssistantFormModal open={editOpen} onOpenChange={setEditOpen} assistant={assistant} />
    </div>
  );
}
