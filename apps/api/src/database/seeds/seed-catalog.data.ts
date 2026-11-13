import {
  AssistantCalculationMethod,
  ClassroomStatus,
  StudentStatus,
  TeacherEmploymentStatus,
} from '@edu-center/shared';

export const SEED_CLASSROOMS = [
  {
    roomNumber: 'R-101',
    name: 'قاعة الخوارزمي الكبرى',
    maxCapacity: 80,
    seatsCount: 80,
    equipment: ['شاشة تفاعلية ذكية', 'نظام صوت محيطي', 'تكييف مركزي', 'سبورة زجاجية'],
    status: ClassroomStatus.AVAILABLE,
    notes: 'مخصصة لمجموعات الصف الثالث الثانوي الكبرى',
  },
  {
    roomNumber: 'R-102',
    name: 'قاعة ابن الهيثم العلمية',
    maxCapacity: 55,
    seatsCount: 55,
    equipment: ['بروجيكتور HD', 'تكييف', 'سبورة مزدوجة', 'كاميرا تسجيل'],
    status: ClassroomStatus.AVAILABLE,
    notes: 'مجهزة للمواد العلمية والفيزياء والكيمياء',
  },
  {
    roomNumber: 'R-103',
    name: 'قاعة نيوتن النموذجية',
    maxCapacity: 45,
    seatsCount: 45,
    equipment: ['شاشة عرض 75 بوصة', 'تكييف', 'سبورة بيضاء'],
    status: ClassroomStatus.AVAILABLE,
    notes: 'مناسبة للمجموعات المتوسطة واللغات',
  },
  {
    roomNumber: 'R-104',
    name: 'قاعة د. أحمد زويل للمراجعات',
    maxCapacity: 30,
    seatsCount: 30,
    equipment: ['سبورة ذكية', 'تكييف', 'إضاءة استوديو'],
    status: ClassroomStatus.AVAILABLE,
    notes: 'مخصصة للحصص الخاصة والمراجعات',
  },
  {
    roomNumber: 'R-105',
    name: 'قاعة الفارابي',
    maxCapacity: 40,
    seatsCount: 40,
    equipment: ['تكييف', 'سبورة بيضاء'],
    status: ClassroomStatus.MAINTENANCE,
    notes: 'تحت الصيانة الدورية لتحديث نظام الصوت والإضاءة',
  },
];

export const SEED_TEACHERS = [
  {
    teacherCode: 'TCH-001',
    fullName: 'أ. محمود عبد الرحمن الشرقاوي',
    phone: '01011223344',
    specialization: 'الرياضيات البحتة والتطبيقية',
    contractDate: '2025-08-01',
    employmentStatus: TeacherEmploymentStatus.ACTIVE,
  },
  {
    teacherCode: 'TCH-002',
    fullName: 'أ. أحمد نبيل الشافعي',
    phone: '01122334455',
    specialization: 'الفيزياء الحديثة والكهربية',
    contractDate: '2025-08-15',
    employmentStatus: TeacherEmploymentStatus.ACTIVE,
  },
  {
    teacherCode: 'TCH-003',
    fullName: 'د. سارة حسام الدين المنسي',
    phone: '01233445566',
    specialization: 'الكيمياء العضوية والتحليلية',
    contractDate: '2025-09-01',
    employmentStatus: TeacherEmploymentStatus.ACTIVE,
  },
  {
    teacherCode: 'TCH-004',
    fullName: 'أ. كريم طارق المنشاوي',
    phone: '01544556677',
    specialization: 'اللغة الإنجليزية',
    contractDate: '2025-09-10',
    employmentStatus: TeacherEmploymentStatus.ACTIVE,
  },
];

export const SEED_ASSISTANTS = [
  {
    assistantCode: 'AST-001',
    fullName: 'م. عمر خالد الجندي',
    phone: '01099887711',
    calculationMethod: AssistantCalculationMethod.SESSION_COMMISSION_PERCENT,
    rateValue: '10.00',
    customFormulaNote: 'نسبة 10% من نصيب السنتر في حصص مجموعة الرياضيات',
    status: 'ACTIVE',
  },
  {
    assistantCode: 'AST-002',
    fullName: 'أ. ندى محمود سليم',
    phone: '01188776622',
    calculationMethod: AssistantCalculationMethod.FIXED_PER_SESSION,
    rateValue: '120.00',
    customFormulaNote: '120 ج.م عن كل حصة منفذة بمجموعات الفيزياء والكيمياء',
    status: 'ACTIVE',
  },
  {
    assistantCode: 'AST-003',
    fullName: 'أ. ياسمين عادل فؤاد',
    phone: '01277665533',
    calculationMethod: AssistantCalculationMethod.FIXED_MONTHLY,
    rateValue: '2500.00',
    customFormulaNote: 'راتب شهري ثابت لمتابعة الغياب والامتحانات الدورية',
    status: 'ACTIVE',
  },
];

const STUDENT_NAMES_32 = [
  'يوسف محمد عبد العزيز', 'مريم أحمد حسن', 'عمر طارق الفقي', 'سلمى خالد منصور',
  'زياد حسام الدين علي', 'ملك وائل الشربيني', 'عبد الرحمن أيمن فوزي', 'جنى سامح الجمل',
  'آدم مصطفى النجار', 'حبيبة ياسر عبد اللطيف', 'سيف الدين هاني زكي', 'نورسين شريف رضوان',
  'مروان تامر الصاوي', 'ليلى عماد الدين سالم', 'كريم حاتم البنا', 'فريدة رامي العشري',
  'حمزة وليد الدسوقي', 'هاجر علاء الدين مرسي', 'مازن أشرف التهامي', 'رنا بهاء الدين خليل',
  'علي محمود أبو الوفا', 'ندى إيهاب الغندور', 'بلال مدحت السعيد', 'تقي عصام الشاذلي',
  'أنس محمد عبد الحميد', 'شهد أسامة البحيري', 'ياسين مجدي عرفات', 'بسملة صلاح الدين قطب',
  'حسن نبيل الكيلاني', 'دانا سامر الرفاعي', 'فارس هيثم زهران', 'سارة معتز الجوهري',
];

const GRADE_LEVELS = [
  'الصف الثالث الثانوي',
  'الصف الثالث الثانوي',
  'الصف الثاني الثانوي',
  'الصف الأول الثانوي',
];

export function buildSeedStudents32() {
  return STUDENT_NAMES_32.map((fullName, idx) => {
    const num = idx + 1;
    const status =
      idx === 30
        ? StudentStatus.SUSPENDED
        : idx === 31
          ? StudentStatus.ARCHIVED
          : StudentStatus.ACTIVE;
    return {
      studentCode: `STD-${String(1000 + num)}`,
      fullName,
      phone: `0101500${String(1000 + num)}`,
      guardianPhone: `0112600${String(1000 + num)}`,
      gradeLevel: GRADE_LEVELS[idx % GRADE_LEVELS.length],
      registrationDate: '2026-09-01',
      status,
      notes: idx === 11 ? 'التحق بمنتصف الشهر (طالب محوّل)' : null,
    };
  });
}
