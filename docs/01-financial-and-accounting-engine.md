# المرجع المحاسبي والمالي الشامل (Financial & Accounting Engine)
> **EduCenter ERP** — نظام إدارة السنتر التعليمي المتكامل  
> **الإصدار البرمجي:** 1.0.0 | **تاريخ التوثيق:** نوفمبر 2026

---

## 1. نظرة عامة على المعمارية المالية (Financial Architecture Overview)

يعتمد نظام **EduCenter ERP** على محرك محاسبي مؤسسي مبني وفق مبادئ **المعمارية النظيفة (Clean Architecture)** و**الوحدات المعزولة (Monolith-Free & SRP)**.  
تم فصل المنطق الرياضي الصافي للمحاسبة داخل وحدات مستقلة نقية (`Calculators`) خالية تماماً من الآثار الجانبية (Side Effects) أو الاعتماد على قاعدة البيانات، مما يتيح اختبارها بنسبة تغطية 100% والتحقق من سلامة الحسابات الرياضية في كافة الحالات الحدية (Edge Cases).

### المكونات الرئيسية للمحرك المالي:
1. **`student-billing.calculator.ts`**: محرك احتساب اشتراكات ومستحقات الطلاب الشهرية مع مراعاة اشتراكات منتصف الشهر وسياسات الغياب والتعويضات.
2. **`revenue-split.calculator.ts`**: محرك تقسيم وتوزيع الإيرادات بين المدرس والسنتر بأربعة نماذج تعاقدية مختلفة.
3. **`assistant-dues.calculator.ts`**: محرك احتساب أتعاب ومستحقات المساعدين بسبعة نماذج محاسبية مع دعم تخصيص النسبة لكل مجموعة.
4. **`student-batch.builder.ts` & `staff-batch.builder.ts`**: وحدات تجميع وبناء دفعات التسوية الشاملة للطلاب والكوادر.
5. **`monthly-settlement.service.ts` & `monthly-settlement-write.repository.ts`**: دورة التسوية الشهرية والتجميد المالي التاريخي الصارم (**Historical Period Lock**).
6. **`payments.service.ts` & `payments.repository.ts`**: إدارة دورة المقبوضات والتحصيل وتوزيع الدفعات (`Payment Allocations`).
7. **`payouts.service.ts` & `teacher/assistant-payouts.repository.ts`**: إدارة دورة صرف مستحقات المدرسين والمساعدين مع أرقام مرجعية مشفرة.
8. **`expenses.service.ts` & `expenses.repository.ts`**: إدارة مصروفات التشغيل للسنتر وتصنيفاتها السبعة.

---

## 2. محرك فواتير واشتراكات الطلاب (`Student Billing Calculator`)

### 2.1. مدخلات الحساب (`StudentBillingInputs`)
- **بيانات الاشتراك (`enrollment`)**:
  - `startDate`: تاريخ بدء اشتراك الطالب في المجموعة (`YYYY-MM-DD`).
  - `endDate`: تاريخ إنهاء الاشتراك الاختياري (`YYYY-MM-DD`).
  - `agreedMonthlyPrice`: السعر الشهري المتفق عليه للطالب.
  - `agreedSessionsCount`: عدد الحصص الشهرية المتفق عليها.
  - `agreedSessionPrice`: سعر الحصة الفردي المتفق عليه (اختياري، إن وجد).
- **سياسة المجموعة المالية (`policy`)**:
  - `fullMonthAbsencePolicy`: سياسة غياب الشهر بالكامل (`EXEMPT_FULL_ABSENCE` | `CHARGE_FULL_SUBSCRIPTION` | `CHARGE_FIXED_RESERVATION_FEE`).
  - `fullAbsenceFixedFee`: قيمة الرسوم الثابتة لحجز المقعد عند غياب الشهر كاملاً.
  - `chargeExcusedAbsence`: هل يُحاسب الطالب مالياً على الغياب بعذر (`true` | `false`).
- **الحصص والحضور والتعويضات**:
  - `sessions`: قائمة الحصص النشطة في المجموعة خلال الشهر المالي (`status != CANCELLED`).
  - `attendances`: سجل حضور الطالب في حصص الشهر (`PRESENT`, `ABSENT`, `EXCUSED`, `MAKEUP_ATTENDED`).
  - `makeups`: حصص التعويض المرتبطة بالطالب ورسومها الإضافية (`isFree`, `extraFee`, `status`).

---

### 2.2. القواعد الرياضية والتشغيلية الصارمة

#### أ) قاعدة اشتراك منتصف الشهر (Mid-Month Enrollment Rule)
لا يدخل الطالب في حساب الحصص المستحقة إلا للحصص التي يقع تاريخها **في أو بعد** تاريخ بدء اشتراكه، وقبل أو في تاريخ انتهائه:
$$\text{Eligible Sessions} = \{ s \in \text{Active Sessions} \mid s.\text{sessionDate} \ge \text{enrollment.startDate} \land (\text{enrollment.endDate} = \text{null} \lor s.\text{sessionDate} \le \text{enrollment.endDate}) \}$$

#### ب) احتساب سعر الحصة اللحظي المجمد (`sessionPriceSnapshot`)
يتم تحديد سعر الحصة وفق الأولوية التالية بدقة سنتين عشريتين (`roundMoney`):
$$\text{sessionPriceSnapshot} = \begin{cases} \text{agreedSessionPrice} & \text{إذا كان } \text{agreedSessionPrice} > 0 \\ \operatorname{round}\left(\dfrac{\text{agreedMonthlyPrice}}{\text{agreedSessionsCount}}\right) & \text{إذا كان } \text{agreedSessionsCount} > 0 \\ 0 & \text{بخلاف ذلك} \end{cases}$$

#### ج) احتساب الحصص الخاضعة للمحاسبة (`billableSessionsCount`)
$$\text{attendedCount} = \text{presentCount} + \max(\text{makeupAttendedCount}, \text{completedMakeupsCount})$$
$$\text{billableSessionsCount} = \text{attendedCount} + \left(\begin{cases} \text{excusedCount} & \text{إذا كان } \text{chargeExcusedAbsence} = \text{true} \\ 0 & \text{إذا كان } \text{chargeExcusedAbsence} = \text{false} \end{cases}\right)$$

#### د) تطبيق سياسة غياب الشهر بالكامل (Full Month Absence Policy)
تتحقق حالة غياب الشهر الكامل إذا توفرت الشروط التالية:
- عدد الحصص المؤهلة للطالب $\text{eligibleSessions} > 0$.
- عدد الحصص المحضورة $\text{attendedCount} = 0$.
- لم يتم تفعيل محاسبة الغياب بعذر، أو أن $\text{excusedCount} = 0$.

عند تحقق هذه الشروط، يتم احتساب المبلغ الأساسي ($\text{baseDue}$) كالتالي:
1. **`EXEMPT_FULL_ABSENCE` (إعفاء كامل):**
   $$\text{baseDue} = 0.00$$
2. **`CHARGE_FULL_SUBSCRIPTION` (تحصيل الاشتراك بالكامل):**
   $$\text{baseDue} = \begin{cases} \text{agreedMonthlyPrice} & \text{إذا كان } \text{agreedMonthlyPrice} > 0 \\ \operatorname{round}(\text{agreedSessionsCount} \times \text{sessionPriceSnapshot}) & \text{بخلاف ذلك} \end{cases}$$
3. **`CHARGE_FIXED_RESERVATION_FEE` (تحصيل رسم حجز مقعد ثابت):**
   $$\text{baseDue} = \text{fullAbsenceFixedFee}$$

#### هـ) احتساب المبلغ الأساسي في حالات الحضور العادي
- إذا حضر الطالب كافة حصص المجموعة الشهرية المتفق عليها بالكامل ($\text{billableSessionsCount} = \text{agreedSessionsCount}$) ولم يكن له سعر حصة استثنائي مخصص:
  $$\text{baseDue} = \text{agreedMonthlyPrice}$$
  *(لحماية الحساب من أي فروق تقريب في القروش الناتجة عن قسمة الشهر على عدد الحصص)*.
- في حال الحضور الجزئي:
  $$\text{baseDue} = \operatorname{round}(\text{billableSessionsCount} \times \text{sessionPriceSnapshot})$$

#### و) رسوم التعويضات الإضافية وإجمالي المستحق
تُضاف رسوم التعويض غير المجانية للحصص غير الملغاة:
$$\text{extraMakeupFees} = \sum_{m \in \text{makeups}, \neg m.\text{isFree} \land m.\text{status} \ne \text{'CANCELLED'}} m.\text{extraFee}$$
$$\text{totalDue} = \operatorname{round}(\text{baseDue} + \text{extraMakeupFees})$$
$$\text{remainingBalance} = \max(0, \operatorname{round}(\text{totalDue} - \text{totalPaid}))$$

---

## 3. محرك توزيع إيرادات المدرس والسنتر (`Revenue Split Calculator`)

يقوم هذا المحرك باحتساب مستحقات المدرس وحصة السنتر من إجمالي إيرادات كل مجموعة دراسية (`grossGroupRevenue`) خلال الشهر المالي، بناءً على الحصص المنفذة فعلياً (`executedSessionsCount`).

### 3.1. الطرق الأربعة لتوزيع الإيراد (`GroupRevenueSplitMethod`)

#### 1. طريقة نسبة الحضور الفعلي (`ACTUAL_ATTENDANCE_RATIO`) — الافتراضية
تعتمد على حصة المدرس المحددة لكل طالب وحصة السنتر المحددة لكل طالب، منسوبة إلى السعر الشهري أو مجموع الحصتين:
$$\text{denominator} = \begin{cases} \text{monthlyPrice} & \text{إذا كان } \text{monthlyPrice} > 0 \\ \text{teacherSharePerStudent} + \text{centerSharePerStudent} & \text{بخلاف ذلك} \end{cases}$$
$$\text{teacherAmount} = \min\left(\text{cleanGross}, \operatorname{round}\left(\dfrac{\text{cleanGross} \times \text{teacherSharePerStudent}}{\text{denominator}}\right)\right)$$
$$\text{centerAmount} = \begin{cases} \operatorname{round}(\text{cleanGross} - \text{teacherAmount}) & \text{إذا كان } \text{centerSharePerStudent} \le 0 \lor |\text{sharesSum} - \text{denominator}| < 0.01 \\ \operatorname{round}\left(\dfrac{\text{cleanGross} \times \text{centerSharePerStudent}}{\text{denominator}}\right) & \text{بخلاف ذلك} \end{cases}$$
حيث $\text{sharesSum} = \text{teacherSharePerStudent} + \text{centerSharePerStudent}$.

#### 2. طريقة المبلغ الثابت لكل طالب مقيد ومفوتر (`FIXED_PER_STUDENT`)
يتقاضى المدرس مبلغاً مقطوعاً عن كل طالب مفوتر في المجموعة، بينما يحصل السنتر على الباقي من الإيراد أو حصته المحددة:
$$\text{teacherAmount} = \operatorname{round}(\text{billedStudentsCount} \times \text{teacherSharePerStudent})$$
$$\text{centerAmount} = \begin{cases} \operatorname{round}(\text{billedStudentsCount} \times \text{centerSharePerStudent}) & \text{إذا كان } \text{centerSharePerStudent} > 0 \\ \max(0, \operatorname{round}(\text{cleanGross} - \text{teacherAmount})) & \text{بخلاف ذلك} \end{cases}$$

#### 3. طريقة المبلغ الثابت لكل حصة منفذة (`FIXED_PER_SESSION`)
يتقاضى المدرس مبلغاً مقطوعاً عن كل حصة تم تنفيذها فعلياً، بما لا يتجاوز إجمالي الإيراد:
$$\text{teacherAmount} = \min(\text{cleanGross}, \operatorname{round}(\text{executedSessionsCount} \times \text{teacherSharePerStudent}))$$
$$\text{centerAmount} = \operatorname{round}(\text{cleanGross} - \text{teacherAmount})$$

#### 4. طريقة النسبة المئوية المخصصة (`CUSTOM_PERCENTAGE`)
يتم تقسيم إجمالي إيراد المجموعة بنسبة مئوية صريحة:
$$\text{teacherAmount} = \operatorname{round}\left(\dfrac{\text{cleanGross} \times \text{clampedTeacherPercentage}}{100}\right)$$
$$\text{centerAmount} = \operatorname{round}(\text{cleanGross} - \text{teacherAmount})$$

> **صمام أمان عدم تنفيذ حصص (Zero Execution Safeguard):**  
> إذا كان عدد الحصص المنفذة $\text{executedSessionsCount} = 0$ أو كان إجمالي الإيراد $\le 0$، تكون مستحقات المدرس والسنتر فوراً مساوية لـ **0.00 ج.م** تلقائياً لمنع صرف مستحقات لمجموعات لم تبدأ بعد.

---

## 4. محرك مستحقات المساعدين (`Assistant Dues Calculator`)

يدعم النظام 7 نماذج تعاقدية لاحتساب مستحقات المساعدين (`AssistantCalculationMethod`). علاوة على ذلك، يتيح النظام لمدير السنتر **تخصيص طريقة الحساب والقيمة لكل مجموعة على حدة** عبر جدول `group_assistants` مع تجاوز القيمة الافتراضية للبروفايل.

### 4.1. النماذج السبعة لحساب أتعاب المساعدين

| طريقة الحساب (`calculationMethod`) | المعادلة الرياضية | معايير القياس |
| :--- | :--- | :--- |
| **`SESSION_COMMISSION_PERCENT`** | $\operatorname{round}\left(\dfrac{\text{cleanRevenue} \times \text{rateValue}}{100}\right)$ | نسبة مئوية من إيراد الحصص المنفذة للمجموعة |
| **`FIXED_PER_SESSION`** | $\operatorname{round}(\text{rateValue} \times \text{sessionsCount})$ | مبلغ ثابت مضروب في عدد الحصص المنفذة |
| **`HOURLY`** | $\operatorname{round}(\text{rateValue} \times \text{hoursCount})$ | أجر بالساعة (محسوب بدقة أو بقيمة افتراضية `sessionsCount * 2` عند عدم تحديد الساعات) |
| **`FIXED_PER_STUDENT`** | $\operatorname{round}(\text{rateValue} \times \text{enrolledCount})$ | مبلغ ثابت عن كل طالب مقيد بالمجموعة |
| **`PER_ATTENDING_STUDENT`** | $\operatorname{round}(\text{rateValue} \times \text{attendancesCount})$ | مبلغ عن كل حالة حضور فعلية مسجلة للطالب |
| **`FIXED_MONTHLY`** | $\operatorname{round}(\text{rateValue})$ | مرتب شهري مقطوع وثابت |
| **`CUSTOM_AGREEMENT`** | $\operatorname{round}(\text{rateValue})$ مع ملاحظة الاتفاق | اتفاق استثنائي مسجل وموثق كتابياً |

### 4.2. أسبقية تخصيص المجموعات (`Group Override Precedence`)
$$\text{effectiveMethod} = \text{overrideCalculationMethod} \parallel \text{assistant.calculationMethod}$$
$$\text{effectiveRate} = \text{overrideRateValue} \ne \text{null} \ ?\ \text{overrideRateValue} : \text{assistant.rateValue}$$

---

## 5. دورة التسوية الشهرية والقفل المالي الصارم (Monthly Settlement & Historical Lock)

لحماية دقة السجلات المحاسبية والضريبية من التلاعب أو التعديل بأثر رجعي، يعتمد النظام آلية قفل تاريخي مشددة (**Immutability & Historical Snapshotting**).

```
   [تسجيل الحضور / الدفعات]
              │
              ▼
   [إعادة الاحتساب التلقائي / recalculate-month]
   - حساب فواتير الطلاب (studentMonthlyRecords)
   - حساب مستحقات المدرسين (teacherDues)
   - حساب مستحقات المساعدين (assistantDues)
              │
              ▼
   [مراجعة وتدقيق الإدارة المحاسبية]
              │
              ▼
   [الإغلاق المالي للشهر / close-month]
   - وضع isClosed = true في studentMonthlyRecords
   - وضع isLocked = true في teacherDues & assistantDues
   - وضع isClosed = true في teacher/assistantMonthlyRecords
   - تسجيل ختم زمني closedAt
              │
              ▼
   [حظر التعديل التام (Closed Month Immutability)]
   - منع تسجيل دفعات جديدة أو تعديل الدفعات السابقة
   - منع صرف مبالغ لمدرسين أو مساعدين
   - منع إضافة أو حذف مصروفات تشغيلية
   - منع إعادة احتساب الشهر المالي (ConflictException 409)
```

### 5.1. حارس الشهر المفتوح (`assertMonthOpen`)
في جميع العمليات المالية الحساسة (`collectPayment`, `recordTeacherPayout`, `recordAssistantPayout`, `createExpense`, `updateExpense`, `removeExpense`, `recalculateMonth`)، يتم استدعاء الدالة المركزية:
```typescript
async assertMonthOpen(yearMonth: string): Promise<void> {
  const summary = await this.overviewRepo.fetchMonthExecutiveSummary(yearMonth);
  if (summary.isMonthClosed) {
    throw new ConflictException(
      `الشهر المالي (${yearMonth}) مغلق نهائياً ولا يمكن إضافة أو تعديل معاملات مالية عليه`,
    );
  }
}
```

### 5.2. حماية لقطة السجل المغلق (`ExistingStudentMonthlySnapshot`)
حتى لو تغيرت أسعار المجموعة لاحقاً أو تم تعديل بيانات الطالب في شهور قادمة، فإن السجلات التاريخية للأشهر المغلقة تحتفظ بسعر الحصة الأصلي وإجمالي المستحق دون تعديل:
```typescript
if (existingRecord?.isClosed) {
  // يمنع نهائياً إعادة احتساب totalDue أو تعديل sessionPriceSnapshot التاريخي
  return {
    ...existingRecord,
    totalPaid: roundMoney(currentTotalPaid ?? existingRecord.totalPaid),
    remainingBalance: roundMoney(Math.max(0, existingRecord.totalDue - totalPaid)),
    isClosed: true,
  };
}
```

---

## 6. دورة المقبوضات والتحصيل والصرف (`Payments, Allocations & Payouts`)

### 6.1. وسائل الدفع المعتمدة (`PaymentMethod`)
يدعم النظام خمس وسائل دفع معتمدة رسمياً تناسب بيئة المراكز التعليمية في مصر:
1. **`CASH`**: دفع نقدي مباشر في خزينة السنتر.
2. **`VODAFONE_CASH`**: محافظ فودافون كاش والمحافظ الإلكترونية للمحمول.
3. **`INSTAPAY`**: شبكة المدفوعات اللحظية المصرية (إنستاباي).
4. **`BANK_TRANSFER`**: تحويل بنكي رسمي إلى حساب المركز.
5. **`CARD`**: بطاقات الدفع الإلكتروني (فيزا / ماستركارد / ميزة) عبر نقاط البيع (POS).

---

### 6.2. الأرقام المرجعية المشفرة للحركات المالية (`Reference Codes`)
تُنشأ أرقام مرجعية مشفرة فريدة لكل حركة مالية لضمان عدم التكرار وسهولة التتبع على الإيصالات المطبوعة:
- **إيصالات تحصيل الطلاب (`Payments`):** بصيغة `RCP-YYYYMM-XXXXXX` (بادئة RCP متبوعة بسنة وشهر التحصيل ثم 6 خانات عشوائية أبجدية-رقمية).
- **أذونات صرف المدرسين (`Teacher Payouts`):** بصيغة `TPY-YYYYMM-XXXX` (بادئة TPY متبوعة بالسنة والشهر ثم 4 خانات عشوائية).
- **أذونات صرف المساعدين (`Assistant Payouts`):** بصيغة `APY-YYYYMM-XXXX` (بادئة APY متبوعة بالسنة والشهر ثم 4 خانات عشوائية).

---

### 6.3. آلية توزيع الدفعات (`Payment Allocations`)
عند تحصيل دفعة من الطالب عبر `POST /api/finance/payments`:
1. يتم التأكد من أن المبلغ أكبر من صفر، وتحديد وسيلة الدفع المعتمدة (`paymentMethod`).
2. التحقق من أن الشهر المالي مفتوح عبر `assertMonthOpen(yearMonth)`.
3. توليد رقم إيصال فريد آلياً بصيغة `RCP-YYYYMM-XXXXXX` في حال لم يُحدد يدوياً.
4. إذا حدد المحصل توزيعاً صريحاً على مجموعات الطالب (`allocations`)، يتم التحقق الصارم من أن:
   $$\sum \text{allocatedAmount} = \text{totalPaymentAmount}$$
   وفي حال عدم التطابق، يُرفض الطلب فوراً بـ `BadRequestException`.
5. في حال التحصيل العام دون تحديد تفصيلي، يقوم النظام آلياً بتوزيع المبلغ على المجموعات المستحقة للطالب بترتيب الأسبقية.
6. حفظ الدفعة وسجلات التوزيع داخل معاملة ذرية واحدة (`Database Transaction`).
7. تدوين الحدث فوراً في سجل التدقيق الأمني (`Audit Log`).
8. إبطال الكاش المرتبط بلوحة المؤشرات والتقارير المالية (`dashboard:summary:*`, `reports:*`).

---

## 7. المصروفات التشغيلية وصافي دخل السنتر (Expenses & Net Center Income)

### 7.1. تصنيفات المصروفات السبعة (`ExpenseCategory`)
1. **`RENT`**: إيجار المقرات والقاعات الدراسية.
2. **`ELECTRICITY_WATER`**: فواتير الكهرباء والمياه والمرافق.
3. **`INTERNET`**: اشتراكات الإنترنت والاتصالات.
4. **`MAINTENANCE`**: صيانة الأجهزة والتكييفات والمقاعد.
5. **`SUPPLIES`**: أدوات ومستلزمات مكتبية وطباعة وأوراق.
6. **`ADMINISTRATIVE`**: بوفيه، نظافة، ضيافة، ومصاريف إدارية.
7. **`OTHER`**: أي مصروفات تشغيلية أخرى.

### 7.2. معادلة صافي الأرباح الشهرية (Net Profit Formula)
$$\text{Gross Revenue} = \sum \text{Student Payments Collected}$$
$$\text{Total Payouts} = \sum \text{Teacher Payouts} + \sum \text{Assistant Payouts}$$
$$\text{Total Expenses} = \sum \text{Center Operational Expenses}$$
$$\mathbf{Net\ Center\ Income} = \text{Gross Revenue} - \text{Total Payouts} - \text{Total Expenses}$$

يتم احتساب هذه القيم لحظياً وعرضها في الملخص التنفيذي للشهر (`/api/finance/month-summary`) ولوحة الإحصائيات المركزية والتقارير المالية الموسعة.
