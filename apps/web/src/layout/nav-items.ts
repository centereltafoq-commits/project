import {
  BarChart3,
  BookOpen,
  Building2,
  Calendar,
  CalendarCheck2,
  ClipboardCheck,
  GraduationCap,
  LayoutDashboard,
  ScrollText,
  ShieldCheck,
  UserCheck,
  Users,
  Wallet,
  LucideIcon,
} from 'lucide-react';
import { PERMISSIONS } from '@edu-center/shared';

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  permission?: string;
}

export const SIDEBAR_NAV_ITEMS: NavItem[] = [
  { label: 'لوحة التحكم', to: '/', icon: LayoutDashboard, permission: PERMISSIONS.DASHBOARD_VIEW },
  { label: 'إدارة الطلاب', to: '/students', icon: GraduationCap, permission: PERMISSIONS.STUDENTS_VIEW },
  { label: 'إدارة المدرسين', to: '/teachers', icon: UserCheck, permission: PERMISSIONS.TEACHERS_VIEW },
  { label: 'إدارة المساعدين', to: '/assistants', icon: Users, permission: PERMISSIONS.ASSISTANTS_VIEW },
  { label: 'المجموعات والاشتراكات', to: '/groups', icon: BookOpen, permission: PERMISSIONS.GROUPS_VIEW },
  { label: 'الحضور والتعويضات', to: '/attendance', icon: ClipboardCheck, permission: PERMISSIONS.ATTENDANCE_VIEW },
  { label: 'الحسابات والمالية', to: '/finance', icon: Wallet, permission: PERMISSIONS.FINANCE_VIEW },
  { label: 'حجز المواعيد', to: '/bookings', icon: CalendarCheck2, permission: PERMISSIONS.BOOKINGS_VIEW },
  { label: 'إدارة القاعات', to: '/classrooms', icon: Building2, permission: PERMISSIONS.CLASSROOMS_VIEW },
  { label: 'التقويم الموحد', to: '/calendar', icon: Calendar, permission: PERMISSIONS.CALENDAR_VIEW },
  { label: 'التقارير التفصيلية', to: '/reports', icon: BarChart3, permission: PERMISSIONS.REPORTS_VIEW },
  { label: 'المستخدمون والصلاحيات', to: '/users', icon: ShieldCheck, permission: PERMISSIONS.USERS_VIEW },
  { label: 'سجل العمليات (Audit)', to: '/audit-logs', icon: ScrollText, permission: PERMISSIONS.AUDIT_VIEW },
];

