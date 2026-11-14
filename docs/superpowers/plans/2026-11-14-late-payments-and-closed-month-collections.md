# خطة تنفيذ: تحصيل المتأخرات وصرف المستحقات للشهور السابقة والمغلقة وربطها باليومية والتقارير

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** السماح بتحصيل متأخرات الطلاب وصرف متبقي مستحقات المدرسين والمساعدين عن أي شهر سابق (حتى لو كان الشهر مغلقاً مالياً)، مع إتاحة اختيار الشهر المستحق مباشرة من نافذة التحصيل ومن بروفايل الطالب، وتوضيح الفرق في التقارير واليومية بين «تحصيل مستحقات الشهر» و«النقدية الفعلية المحصّلة خلال اليوم/الشهر شاملة المتأخرات».

**Architecture:**
1. **فصل تجميد الأسعار والمستحقات (`isClosed`) عن سداد المتبقي (`remainingBalance`):** عند إغلاق الشهر مالياً يظل `totalDue` و`sessionPriceSnapshot` و`totalDues` مجمدين بالكامل (يُمنع إعادة الاحتساب أو تعديل الحصص أو إضافة مصروفات جديدة على الشهر المغلق)، بينما يُسمح بتسجيل إيصالات تحصيل الطلاب وسندات صرف المدرسين/المساعدين طالما المبلغ لا يتجاوز `remainingBalance`.
2. **الفصل المحاسبي بين شهر الاستحقاق (`yearMonth`) وتاريخ الحركة الفعلي (`paymentDate` / `payoutDate`):** كل إيصال يحمل `yearMonth` (الشهر الذي يخصم من مديونيته) و`paymentDate` (اليوم الفعلي الذي دخلت فيه الفلوس الخزينة).
3. **وضوح التقارير وسجل اليومية:** تمييز تحصيل المتأخرات في سجل اليومية (`تحصيل متأخرات عن شهر YYYY-MM`)، وإظهار كلٍ من «المحصّل لحساب الشهر» و«النقدية المحصّلة فعلياً بالخزينة خلال الشهر» في الملخص المالي.

**Tech Stack:** NestJS, Drizzle ORM (PostgreSQL), React 18, TanStack Query, TailwindCSS, Vitest.

## Global Constraints
- Zero God Files: الالتزام بمبدأ المسؤولية الواحدة (SRP) وعدم دمج منطق الواجهة أو الحسابات في ملف واحد ضخم.
- الحفاظ على أمان الإغلاق المالي: منع `recalculateMonth` الصريح، ومنع تعديل الحضور، ومنع إضافة/تعديل/حذف المصروفات (`expenses`) على الشهور المغلقة، والسماح فقط بسداد الأرصدة المتبقية (`remainingBalance > 0`).
- عدم السماح أبداً بدفع مبلغ أكبر من `remainingBalance` في الشهر المغلق أو المفتوح.

---

## خريطة الملفات المستهدفة (File Structure)

### أولاً: الواجهة الخلفية (`apps/api`)
- Modify: `apps/api/src/modules/finance/payments.service.ts` — إزالة المنع القسري `assertMonthOpen(dto.yearMonth)` قبل التحصيل، والاكتفاء بـ `recalculateMonth(dto.yearMonth)` (الذي يتخطى إعادة الاحتساب تلقائياً إذا كان الشهر مغلقاً ويحدثه إذا كان مفتوحاً).
- Modify: `apps/api/src/modules/finance/repositories/payments.repository.ts` — السماح بتحصيل الدفعات على السجلات الشهرية المغلقة (`isClosed = true`) بشرط وجود سجلات مستحقة (`monthlyRows.length > 0`) وأن يكون `input.amount <= totalRemaining`، مع تحديث `totalPaid` و`remainingBalance` فقط دون المساس بـ `totalDue` أو `sessionPriceSnapshot`.
- Modify: `apps/api/src/modules/finance/payouts.service.ts` — إزالة `assertMonthOpen(dto.yearMonth)` من `recordTeacherPayout` و`recordAssistantPayout` للسماح بصرف المتبقي للمدرس/المساعد بعد إغلاق الشهر (مع بقاء شرط عدم تجاوز `remainingBalance` في المستودع).
- Modify: `apps/api/src/modules/finance/repositories/teacher-payouts.repository.ts` & `apps/api/src/modules/finance/repositories/assistant-payouts.repository.ts` — التحقق من أنه في حالة كون الشهر مغلقاً لا يُسمح بالصرف إلا إذا كان هناك سجل شهري موجود ورصيده المتبقي `remainingBalance >= input.amount`.
- Modify: `apps/api/src/modules/finance/repositories/daily-ledger.repository.ts` — قصر `daysSummary` والحركات اليومية في الشهر المختار على الحركات التي وقع تاريخها الفعلي (`paymentDate` / `payoutDate` / `expenseDate`) داخل الشهر أو في اليوم المحدد `query.date`، وتمييز تسمية الحركة (`categoryLabel`) عندما يكون `r.yearMonth !== r.paymentDate.slice(0, 7)` لتظهر بصيغة `تحصيل متأخرات طالب (عن شهر YYYY-MM)`.
- Modify: `apps/api/src/modules/reports/repositories/financial-summary.repository.ts` — إضافة بند واضح في تقرير الملخص المالي الشهري يوضح «إجمالي النقدية الداخلة للخزينة خلال الشهر (شاملة متأخرات شهور سابقة)» بجانب «المحصّل من مستحقات هذا الشهر».
- Test: `apps/api/src/modules/finance/closed-month-lock.spec.ts` — تحديث الاختبارات لإثبات السماح بتحصيل المتأخرات وصرف المتبقي على الشهر المغلق مع استمرار منع إعادة الاحتساب والمصروفات وتجاوز المتبقي.

### ثانياً: الواجهة الأمامية (`apps/web`)
- Modify: `apps/web/src/features/finance/modals/collect-payment-modal.tsx` — إضافة `MonthPicker` داخل نافذة التحصيل بعنوان **«الشهر المستحق السداد عنه»** (مدعوم بالتغيير عندما لا يكون مقيداً بصف محدد، أو يظهر بوضوح مع تنبيه إذا كان يخص شهراً سابقاً غير الشهر الحالي).
- Modify: `apps/web/src/features/finance/tabs/student-billing-tab.tsx` — تفعيل زر **«تحصيل»** حتى لو كان الشهر مغلقاً (`isMonthClosed`) طالما `r.remainingBalance > 0` ولدى المستخدم صلاحية `FINANCE_COLLECT_PAYMENT`.
- Modify: `apps/web/src/features/finance/tabs/teacher-dues-tab.tsx` & `apps/web/src/features/finance/tabs/assistant-dues-tab.tsx` — تفعيل زر **«صرف مستحقات»** حتى لو كان الشهر مغلقاً طالما `r.remainingBalance > 0` ولدى المستخدم صلاحية `FINANCE_PAYOUTS`.
- Modify: `apps/web/src/features/finance/modals/close-month-modal.tsx` — تحديث رسالة التأكيد لتوضيح أن الإغلاق يجمّد الأسعار وإجمالي المستحقات والمصروفات، مع استمرار إتاحة تحصيل المتأخرات المتبقية على الطلاب وصرف متبقي مستحقات المدرسين والمساعدين.
- Modify: `apps/web/src/features/students/components/student-selected-month-details.tsx` & `apps/web/src/features/students/student-profile-page.tsx` — إضافة زر مباشر **«تحصيل متأخرات هذا الشهر»** داخل تفاصيل الشهر المختار في بروفايل الطالب يفتح `CollectPaymentModal` جاهزاً ببيانات الطالب والشهر المختار، ثم يعرض نافذة طباعة الإيصال (`ReceiptPrintModal`) فور السداد.

---

### Task 1: السماح بتحصيل متأخرات الطلاب وصرف متبقي المدرسين والمساعدين في الشهور المغلقة (Backend)

**Files:**
- Modify: `apps/api/src/modules/finance/payments.service.ts`
- Modify: `apps/api/src/modules/finance/repositories/payments.repository.ts`
- Modify: `apps/api/src/modules/finance/payouts.service.ts`
- Modify: `apps/api/src/modules/finance/repositories/teacher-payouts.repository.ts`
- Modify: `apps/api/src/modules/finance/repositories/assistant-payouts.repository.ts`
- Test: `apps/api/src/modules/finance/closed-month-lock.spec.ts`

**Interfaces:**
- Consumes: `MonthlySettlementService.recalculateMonth(yearMonth: string)` (existing — returns early with 0 updates when `isMonthClosed === true`).
- Produces: `PaymentsService.collectPayment`, `PayoutsService.recordTeacherPayout`, `PayoutsService.recordAssistantPayout` allowing settlement of remaining balances on closed months while blocking recalculation and expenses.

- [ ] **Step 1: تحديث اختبارات `closed-month-lock.spec.ts` لتعكس السلوك المحاسبي الجديد**

في `apps/api/src/modules/finance/closed-month-lock.spec.ts`، استبدل اختباري رفض التحصيل والصرف (`it('rejects student payment collection on a closed month')` و`it('rejects teacher and assistant payouts on a closed month')`) باختبارات تتحقق من:
1. السماح بتحصيل دفعة طالب على شهر مغلق بدون استدعاء إعادة احتساب فعلية (`fetchMonthSettlementSnapshot` لا تُستدعى).
2. السماح بصرف متبقي مستحقات المدرس والمساعد على شهر مغلق بدون إعادة احتساب.
3. استمرار رفض إضافة/تعديل/حذف المصروفات (`expensesService`) واستمرار رفض `recalculateMonth(yearMonth, actor)` و`closeMonth(yearMonth, actor)` على الشهر المغلق.

```typescript
  it('allows collecting overdue student payment on a closed month without recalculating frozen dues', async () => {
    paymentsWriteRepo.createPaymentWithAllocations.mockResolvedValue({
      id: 'pay-1',
      receiptNumber: 'RCP-202610-000001',
      studentId: 'std-1',
      yearMonth: '2026-10',
      amount: 100,
      paymentDate: '2026-11-14',
      paymentMethod: PaymentMethod.CASH,
      allocations: [],
    });

    const result = await paymentsService.collectPayment(
      {
        studentId: 'std-1',
        yearMonth: '2026-10',
        amount: 100,
        paymentDate: '2026-11-14',
        paymentMethod: PaymentMethod.CASH,
      },
      actor,
    );

    expect(result.id).toBe('pay-1');
    expect(readRepo.fetchMonthSettlementSnapshot).not.toHaveBeenCalled();
    expect(paymentsWriteRepo.createPaymentWithAllocations).toHaveBeenCalledTimes(1);
  });

  it('allows settling remaining teacher and assistant payouts on a closed month without recalculating', async () => {
    teacherPayoutRepo.createTx.mockResolvedValue({
      id: 'tpy-1',
      referenceNumber: 'TPY-202610-0001',
      teacherId: 'tch-1',
      yearMonth: '2026-10',
      amount: 100,
      paymentMethod: PaymentMethod.CASH,
    });
    assistantPayoutRepo.createTx.mockResolvedValue({
      id: 'apy-1',
      referenceNumber: 'APY-202610-0001',
      assistantId: 'ast-1',
      yearMonth: '2026-10',
      amount: 50,
      paymentMethod: PaymentMethod.CASH,
    });

    await expect(
      payoutsService.recordTeacherPayout(
        {
          teacherId: 'tch-1',
          yearMonth: '2026-10',
          amount: 100,
          paymentMethod: PaymentMethod.CASH,
        },
        actor,
      ),
    ).resolves.toMatchObject({ id: 'tpy-1' });

    await expect(
      payoutsService.recordAssistantPayout(
        {
          assistantId: 'ast-1',
          yearMonth: '2026-10',
          amount: 50,
          paymentMethod: PaymentMethod.CASH,
        },
        actor,
      ),
    ).resolves.toMatchObject({ id: 'apy-1' });

    expect(readRepo.fetchMonthSettlementSnapshot).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: تشغيل الاختبار للتأكد من فشله قبل التعديل**

Run: `npx --prefix apps/api vitest run src/modules/finance/closed-month-lock.spec.ts`
Expected: FAIL بسبب `ConflictException` في `payments.service.ts` و`payouts.service.ts`.

- [ ] **Step 3: تعديل `payments.service.ts` و`payments.repository.ts` و`payouts.service.ts`**

1. في `apps/api/src/modules/finance/payments.service.ts` (السطر 45):
   احذف السطر `await this.monthlySettlementService.assertMonthOpen(dto.yearMonth);` وأبقِ فقط:
   ```typescript
   // إذا كان الشهر مفتوحاً يُعاد احتسابه، وإذا كان مغلقاً يتم تخطي إعادة الاحتساب تلقائياً مع السماح بتحصيل المتأخرات
   await this.monthlySettlementService.recalculateMonth(dto.yearMonth);
   ```
2. في `apps/api/src/modules/finance/repositories/payments.repository.ts` (الأسطر 70–83):
   استبدل منع الشهر المغلق بالتحقق من وجود مستحقات متبقية فقط:
   ```typescript
      const isClosedMonth = monthlyRows.some((r) => r.isClosed);
      if (isClosedMonth && monthlyRows.length === 0) {
        throw new ConflictException(
          'هذا الشهر المالي مغلق ولا توجد مستحقات مسجلة على الطالب فيه',
        );
      }

      const totalRemaining = roundMoney(
        monthlyRows.reduce((sum, r) => sum + parseMoney(r.remainingBalance), 0),
      );

      if (monthlyRows.length > 0 && totalRemaining <= 0) {
        throw new BadRequestException(
          'لا توجد مبالغ متبقية مستحقة على الطالب لهذا الشهر (خالص بالكامل)',
        );
      }

      if (monthlyRows.length > 0 && input.amount > totalRemaining) {
        throw new BadRequestException(
          `المبلغ المدفوع (${input.amount} ج.م) يتجاوز إجمالي المستحق المتبقي على الطالب لهذا الشهر (${totalRemaining} ج.م)`,
        );
      }
   ```
3. في `apps/api/src/modules/finance/payouts.service.ts`:
   احذف `await this.monthlySettlementService.assertMonthOpen(dto.yearMonth);` من `recordTeacherPayout` (السطر 39) ومن `recordAssistantPayout` (السطر 96)، مع الإبقاء على `await this.monthlySettlementService.recalculateMonth(dto.yearMonth);`.

- [ ] **Step 4: تشغيل الاختبار للتأكد من نجاحه**

Run: `npx --prefix apps/api vitest run src/modules/finance/closed-month-lock.spec.ts`
Expected: PASS (جميع الاختبارات ناجحة).

---

### Task 2: ضبط سجل اليومية (`DailyLedgerRepository`) والملخص المالي (`FinancialSummaryRepository`) للمدفوعات المتأخرة عبر الشهور

**Files:**
- Modify: `apps/api/src/modules/finance/repositories/daily-ledger.repository.ts`
- Modify: `apps/api/src/modules/reports/repositories/financial-summary.repository.ts`
- Modify: `apps/api/src/modules/reports/reports.service.spec.ts`

**Interfaces:**
- Consumes: `DailyLedgerQueryDto` (`yearMonth?: string`, `date?: string`).
- Produces:
  - في `DailyLedgerRepository`: يعتمد `daysSummary` وحركات اليومية على تاريخ الحركة الفعلي (`paymentDate`, `payoutDate`, `expenseDate`) الواقع داخل الشهر المختار (`startOfMonth .. endOfMonth`) أو اليوم المختار `query.date`، بحيث تظهر أي دفعة متأخرة دُفعت اليوم (مثلاً في نوفمبر عن شهر سبتمبر) في يومية نوفمبر بتاريخ اليوم، مع توضيح `categoryLabel`:
    - إذا كان `r.yearMonth === r.paymentDate.slice(0, 7)`: `تحصيل اشتراك طالب (${r.yearMonth})`
    - إذا كان `r.yearMonth !== r.paymentDate.slice(0, 7)`: `تحصيل متأخرات طالب (عن شهر ${r.yearMonth})`
  - في `FinancialSummaryRepository`: يعرض في الملخص الشهري كلاً من:
    - `إجمالي التحصيل لحساب مستحقات هذا الشهر` (`payments.yearMonth = yearMonth`)
    - `إجمالي النقدية المحصّلة فعلياً بالخزينة خلال الشهر (شاملة المتأخرات)` (`payments.paymentDate BETWEEN startOfMonth AND endOfMonth`)

- [ ] **Step 1: تحديث `DailyLedgerRepository` في `apps/api/src/modules/finance/repositories/daily-ledger.repository.ts`**

1. في استعلامات `payments`, `teacherPayouts`, `assistantPayouts`, `expenses` داخل `getDailyLedger`:
   اجعل شرط الفلترة يعتمد على التاريخ الفعلي للحركة داخل الشهر المختار (`gte(dateCol, startOfMonth), lte(dateCol, endOfMonth)`) أو `eq(dateCol, query.date)` عند تمرير `query.date`:
   ```typescript
   // payments where clause:
   query.date
     ? eq(payments.paymentDate, query.date)
     : and(
         gte(payments.paymentDate, startOfMonth),
         lte(payments.paymentDate, endOfMonth),
       )
   ```
   (وبالمثل لـ `teacherPayouts.payoutDate`، `assistantPayouts.payoutDate`، و`expenses.expenseDate`).
2. عند بناء `categoryLabel` للدفعات (`PAYMENT`) وسندات الصرف (`TEACHER_PAYOUT`, `ASSISTANT_PAYOUT`):
   ```typescript
   const isCrossMonthPayment = r.yearMonth !== r.paymentDate.slice(0, 7);
   const categoryLabel = isCrossMonthPayment
     ? `تحصيل متأخرات طالب (عن شهر ${r.yearMonth})`
     : `تحصيل اشتراك طالب (${r.yearMonth})`;
   ```

- [ ] **Step 2: تحديث `FinancialSummaryRepository` في `apps/api/src/modules/reports/repositories/financial-summary.repository.ts`**

أضف استعلاماً لحساب النقدية المحصلة فعلياً بالخزينة خلال أيام الشهر التقويمي (`actualMonthCashCollected` حيث `paymentDate` بين أول وآخر يوم في `yearMonth`)، وأضف صفاً توضيحياً في `statementRows`:
```typescript
{
  id: 'rev-cash-window',
  sectionAr: 'الإيرادات والتحصيل',
  lineItemAr: 'إجمالي النقدية الداخلة للخزينة خلال أيام الشهر (شاملة متأخرات شهور سابقة)',
  amount: actualMonthCashCollected,
  rowKind: 'INFLOW',
  notes: 'حسب تاريخ السداد الفعلي (paymentDate) خلال الشهر',
}
```

- [ ] **Step 3: تشغيل اختبارات المالية والتقارير في الخادم الخلفي**

Run: `npx --prefix apps/api vitest run src/modules/finance src/modules/reports`
Expected: PASS.

---

### Task 3: تحديث نافذة التحصيل وتبويبات المالية وبروفايل الطالب لدعم تحصيل أي شهر سابق أو مغلق (Frontend)

**Files:**
- Modify: `apps/web/src/features/finance/modals/collect-payment-modal.tsx`
- Modify: `apps/web/src/features/finance/tabs/student-billing-tab.tsx`
- Modify: `apps/web/src/features/finance/tabs/teacher-dues-tab.tsx`
- Modify: `apps/web/src/features/finance/tabs/assistant-dues-tab.tsx`
- Modify: `apps/web/src/features/finance/modals/close-month-modal.tsx`
- Modify: `apps/web/src/features/students/components/student-selected-month-details.tsx`
- Modify: `apps/web/src/features/students/student-profile-page.tsx`

**Interfaces:**
- `CollectPaymentModalProps`:
  يبقى متوافقاً مع الواجهة الحالية (`open`, `onOpenChange`, `yearMonth`, `presetRecord`, `lookups`, `onReceiptCreated`) مع إضافة إمكانية تمرير `presetStudent?: { id: string; fullName: string; studentCode: string; remainingBalance?: number }` (اختياري لبروفايل الطالب) وحالة داخلية `targetYearMonth` تبدأ بـ `presetRecord?.yearMonth || yearMonth`.

- [ ] **Step 1: إضافة اختيار «الشهر المستحق السداد عنه (`MonthPicker`)» في `CollectPaymentModal`**

في `apps/web/src/features/finance/modals/collect-payment-modal.tsx`:
1. أضف state داخلي:
   ```tsx
   const [targetYearMonth, setTargetYearMonth] = React.useState(yearMonth);
   ```
   ويُعاد ضبطه في `useEffect` عند فتح النافذة إلى `presetRecord?.yearMonth || yearMonth`.
2. أضف حقل `<MonthPicker>` داخل النموذج بعنوان `"الشهر المستحق السداد عنه (شهر الاشتراك)"` بجانب حقل `<DatePicker label="تاريخ السداد الفعلي (اليوم)" ... />`، بحيث يرسل الـ payload:
   ```tsx
   yearMonth: targetYearMonth,
   paymentDate,
   ```
3. إذا كان `targetYearMonth !== paymentDate.slice(0, 7)`، اعرض تنبيهاً لطيفاً باللون الأزرق/الكهرماني يوضح:
   `سيتم خصم هذه الدفعة من مستحقات شهر ${formatYearMonthAr(targetYearMonth)}، بينما ستُسجّل حركة النقدية في يومية تاريخ ${formatDateAr(paymentDate)}.`

- [ ] **Step 2: تفعيل أزرار التحصيل والصرف للشهور المغلقة في تبويبات المالية**

1. في `apps/web/src/features/finance/tabs/student-billing-tab.tsx`:
   عدّل السطر 37 من:
   `const canCollect = hasPermission(PERMISSIONS.FINANCE_COLLECT_PAYMENT) && !isMonthClosed;`
   إلى:
   `const canCollect = hasPermission(PERMISSIONS.FINANCE_COLLECT_PAYMENT);`
   وغيّر نص زر التحصيل في الجدول إلى `{r.isClosed ? 'تحصيل متأخرات' : 'تحصيل'}`.
2. في `apps/web/src/features/finance/tabs/teacher-dues-tab.tsx` (السطر 33) و`apps/web/src/features/finance/tabs/assistant-dues-tab.tsx` (السطر 37):
   عدّل `canPayout` إلى `const canPayout = hasPermission(PERMISSIONS.FINANCE_PAYOUTS);` ليبقى زر الصرف متاحاً لأي سجل له `remainingBalance > 0`.
3. في `apps/web/src/features/finance/modals/close-month-modal.tsx`:
   حدّث النص التوضيحي ليذكر صراحة أن إغلاق الشهر يجمّد الأسعار وإجمالي المستحقات والمصروفات، مع بقاء إمكانية تحصيل المتأخرات المتبقية على الطلاب وصرف المستحقات المتبقية للمدرسين والمساعدين.

- [ ] **Step 3: إضافة زر «تحصيل متأخرات هذا الشهر» مباشرة داخل بروفايل الطالب (`student-selected-month-details.tsx` & `student-profile-page.tsx`)**

1. في `apps/web/src/features/students/components/student-selected-month-details.tsx`:
   - أضف خاصية اختيارية `onCollectMonthPayment?: (record?: StudentProfileMonthlyGroupItem) => void` و`canCollectPayment?: boolean`.
   - في رأس قسم تفاصيل الشهر (وعند كل مجموعة عليها `remaining > 0`)، اعرض زر **«تحصيل دفعة لهذا الشهر»** عند توفر الصلاحية ووجود متبقي.
2. في `apps/web/src/features/students/student-profile-page.tsx`:
   - اربط الزر بفتح `CollectPaymentModal` مع تمرير بيانات الطالب والشهر المختار (`yearMonth`)، وعند نجاح التحصيل افتح `ReceiptPrintModal` لطباعة الإيصال مباشرة وقم بتحديث بيانات بروفايل الطالب (`invalidateQueries`).

- [ ] **Step 4: التحقق الشامل من الاختبارات والبناء (`apps/api` + `apps/web`)**

Run:
```bash
npm --prefix apps/api test && npm --prefix apps/api run build
npm --prefix apps/web test && npm --prefix apps/web run build
```
Expected: نجاح جميع اختبارات `apps/api` و`apps/web` واكتمال البناء بدون أخطاء، ثم إعادة تشغيل خادم `API`.
