import {
  AssistantCalculationMethod,
  ClassroomStatus,
  StudentStatus,
  TeacherEmploymentStatus,
} from '@edu-center/shared';

export const SEED_GRADE_LEVELS = [
  { name: 'أولى إعدادي', code: 'GRD-01', orderIndex: 1 },
  { name: 'تانية إعدادي', code: 'GRD-02', orderIndex: 2 },
  { name: 'تالتة إعدادي', code: 'GRD-03', orderIndex: 3 },
  { name: 'أولى ثانوي', code: 'GRD-04', orderIndex: 4 },
  { name: 'تانية ثانوي', code: 'GRD-05', orderIndex: 5 },
  { name: 'تالتة ثانوي', code: 'GRD-06', orderIndex: 6 },
];

export const SEED_CLASSROOMS = [
  {
    roomNumber: 'R-101',
    name: 'قاعة الخوارزمي الكبرى',
    maxCapacity: 60,
    seatsCount: 60,
    equipment: ['شاشة تفاعلية ذكية', 'نظام صوت محيطي', 'تكييف مركزي', 'سبورة زجاجية'],
    status: ClassroomStatus.AVAILABLE,
    notes: 'مخصصة لمجموعات المرحلة الثانوية الكبرى',
  },
  {
    roomNumber: 'R-102',
    name: 'قاعة ابن الهيثم العلمية',
    maxCapacity: 45,
    seatsCount: 45,
    equipment: ['بروجيكتور HD', 'تكييف', 'سبورة مزدوجة', 'كاميرا تسجيل'],
    status: ClassroomStatus.AVAILABLE,
    notes: 'مجهزة للمواد العلمية والفيزياء والكيمياء',
  },
  {
    roomNumber: 'R-103',
    name: 'قاعة نيوتن النموذجية',
    maxCapacity: 35,
    seatsCount: 35,
    equipment: ['شاشة عرض 75 بوصة', 'تكييف', 'سبورة بيضاء'],
    status: ClassroomStatus.AVAILABLE,
    notes: 'مناسبة لمجموعات الإعدادي واللغات',
  },
  {
    roomNumber: 'R-104',
    name: 'قاعة الفارابي للمراجعات',
    maxCapacity: 30,
    seatsCount: 30,
    equipment: ['سبورة ذكية', 'تكييف', 'إضاءة استوديو'],
    status: ClassroomStatus.AVAILABLE,
    notes: 'جاهزة لاستقبال مجموعات جديدة من شاشة إدارة القاعات',
  },
  {
    roomNumber: 'R-105',
    name: 'قاعة د. أحمد زويل',
    maxCapacity: 40,
    seatsCount: 40,
    equipment: ['تكييف', 'سبورة بيضاء'],
    status: ClassroomStatus.MAINTENANCE,
    notes: 'تحت الصيانة الدورية لتحديث نظام الصوت والإضاءة',
  },
];

export const SEED_TEACHERS = [
  {
    teacherCode: 'TCH-2026',
    fullName: 'أ. محمود عبد الرحمن الشرقاوي',
    phone: '01011223344',
    specialization: 'الرياضيات البحتة والتطبيقية',
    contractDate: '2026-09-01',
    employmentStatus: TeacherEmploymentStatus.ACTIVE,
  },
  {
    teacherCode: 'TCH-2041',
    fullName: 'أ. أحمد نبيل الشافعي',
    phone: '01122334455',
    specialization: 'الفيزياء الحديثة والكهربية',
    contractDate: '2026-09-01',
    employmentStatus: TeacherEmploymentStatus.ACTIVE,
  },
  {
    teacherCode: 'TCH-2058',
    fullName: 'د. سارة حسام الدين المنسي',
    phone: '01233445566',
    specialization: 'الكيمياء العضوية والتحليلية',
    contractDate: '2026-09-05',
    employmentStatus: TeacherEmploymentStatus.ACTIVE,
  },
  {
    teacherCode: 'TCH-2074',
    fullName: 'أ. كريم طارق المنشاوي',
    phone: '01544556677',
    specialization: 'اللغة الإنجليزية',
    contractDate: '2026-09-10',
    employmentStatus: TeacherEmploymentStatus.ACTIVE,
  },
  {
    teacherCode: 'TCH-2089',
    fullName: 'أ. ياسر فتحي بدران',
    phone: '01066778899',
    specialization: 'العلوم المتكاملة',
    contractDate: '2026-09-12',
    employmentStatus: TeacherEmploymentStatus.ON_LEAVE,
  },
  {
    teacherCode: 'TCH-2095',
    fullName: 'أ. مها عبد الحميد السيد',
    phone: '01155443322',
    specialization: 'اللغة العربية والنحو',
    contractDate: '2026-08-20',
    employmentStatus: TeacherEmploymentStatus.INACTIVE,
  },
];

export const SEED_ASSISTANTS = [
  {
    assistantCode: 'AST-3101',
    fullName: 'م. عمر خالد الجندي',
    phone: '01099887711',
    calculationMethod: AssistantCalculationMethod.SESSION_COMMISSION_PERCENT,
    rateValue: '10.00',
    customFormulaNote: 'نسبة 10% من نصيب السنتر في حصص مجموعة الرياضيات',
    status: 'ACTIVE',
  },
  {
    assistantCode: 'AST-3102',
    fullName: 'أ. ندى محمود سليم',
    phone: '01188776622',
    calculationMethod: AssistantCalculationMethod.FIXED_PER_SESSION,
    rateValue: '120.00',
    customFormulaNote: '120 ج.م عن كل حصة منفذة بمجموعات الفيزياء والكيمياء',
    status: 'ACTIVE',
  },
  {
    assistantCode: 'AST-3103',
    fullName: 'أ. ياسمين عادل فؤاد',
    phone: '01277665533',
    calculationMethod: AssistantCalculationMethod.FIXED_MONTHLY,
    rateValue: '2500.00',
    customFormulaNote: 'راتب شهري ثابت لمتابعة الغياب والامتحانات الدورية',
    status: 'ACTIVE',
  },
  {
    assistantCode: 'AST-3104',
    fullName: 'أ. مصطفى رضا عبد الله',
    phone: '01522334411',
    calculationMethod: AssistantCalculationMethod.FIXED_PER_STUDENT,
    rateValue: '15.00',
    customFormulaNote: 'مساعد متوقف مؤقتاً عن العمل',
    status: 'INACTIVE',
  },
];

const STUDENT_NAMES_24 = [
  'يوسف محمد عبد العزيز',
  'مريم أحمد حسن',
  'عمر طارق الفقي',
  'سلمى خالد منصور',
  'زياد حسام الدين علي',
  'ملك وائل الشربيني',
  'عبد الرحمن أيمن فوزي',
  'جنى سامح الجمل',
  'آدم مصطفى النجار',
  'حبيبة ياسر عبد اللطيف',
  'سيف الدين هاني زكي',
  'نورسين شريف رضوان',
  'مروان تامر الصاوي',
  'ليلى عماد الدين سالم',
  'محمد عبد العزيز أحمد',
  'فريدة رامي العشري',
  'حمزة وليد الدسوقي',
  'هاجر علاء الدين مرسي',
  'مازن أشرف التهامي',
  'رنا بهاء الدين خليل',
  'علي محمود أبو الوفا',
  'ندى إيهاب الغندور',
  'بلال مدحت السعيد',
  'سارة معتز الجوهري',
];

const STUDENT_GRADES = [
  'تالتة ثانوي',
  'تالتة ثانوي',
  'تالتة ثانوي',
  'تالتة ثانوي',
  'تالتة ثانوي',
  'تالتة ثانوي',
  'تالتة ثانوي',
  'تالتة ثانوي',
  'تالتة ثانوي',
  'تالتة ثانوي',
  'تانية ثانوي',
  'تانية ثانوي',
  'تانية ثانوي',
  'تانية ثانوي',
  'أولى إعدادي',
  'أولى إعدادي',
  'أولى إعدادي',
  'أولى إعدادي',
  'أولى إعدادي',
  'أولى ثانوي',
  'تانية إعدادي',
  'تالتة إعدادي',
  'تالتة ثانوي',
  'تانية ثانوي',
];

export function buildSeedStudents24() {
  return STUDENT_NAMES_24.map((fullName, idx) => {
    const num = idx + 1;
    const status =
      idx === 20 || idx === 21
        ? StudentStatus.SUSPENDED
        : idx === 22 || idx === 23
          ? StudentStatus.ARCHIVED
          : StudentStatus.ACTIVE;

    // Showcase optional student phone (null on several records, guardian phone present)
    const studentPhone = idx % 5 === 4 ? null : `0101500${String(5000 + num)}`;

    return {
      studentCode: `STU-2026-${String(5000 + num)}`,
      fullName,
      phone: studentPhone,
      guardianPhone: `0112600${String(5000 + num)}`,
      gradeLevel: STUDENT_GRADES[idx],
      registrationDate: '2026-10-01',
      status,
      notes:
        idx === 10
          ? 'التحق بمنتصف الشهر (طالب محوّل)'
          : idx === 1
            ? 'مشترك في مجموعتين — سداد جزئي للشهر الحالي'
            : idx === 2
              ? 'مشترك في مجموعتين — متأخر عن سداد الشهر الحالي'
              : null,
    };
  });
}
