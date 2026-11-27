import {
  BarChart3,
  BookOpen,
  Building2,
  Calendar,
  ClipboardCheck,
  Database,
  GraduationCap,
  LayoutDashboard,
  MessageCircle,
  ScrollText,
  ShieldCheck,
  UserCheck,
  Users,
  Wallet,
  Settings,
  LucideIcon,
} from 'lucide-react';
import { PERMISSIONS, SystemRole } from '@edu-center/shared';

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  permission?: string;
  anyPermissions?: string[];
  requiredRole?: string;
}

export const SIDEBAR_NAV_ITEMS: NavItem[] = [
  { label: 'لوحة التحكم', to: '/', icon: LayoutDashboard, permission: PERMISSIONS.DASHBOARD_VIEW },
  { label: 'إدارة الطلاب', to: '/students', icon: GraduationCap, permission: PERMISSIONS.STUDENTS_VIEW },
  {
    label: 'إدارة المدرسين',
    to: '/teachers',
    icon: UserCheck,
    anyPermissions: [PERMISSIONS.TEACHERS_VIEW, PERMISSIONS.TEACHERS_VIEW_OWN],
  },
  { label: 'إدارة المساعدين', to: '/assistants', icon: Users, permission: PERMISSIONS.ASSISTANTS_VIEW },
  { label: 'المجموعات والاشتراكات', to: '/groups', icon: BookOpen, permission: PERMISSIONS.GROUPS_VIEW },
  {
    label: 'الحضور والغياب',
    to: '/attendance',
    icon: ClipboardCheck,
    anyPermissions: [
      PERMISSIONS.ATTENDANCE_VIEW,
      PERMISSIONS.SESSIONS_VIEW,
    ],
  },
  {
    label: 'الحسابات والمالية',
    to: '/finance',
    icon: Wallet,
    anyPermissions: [
      PERMISSIONS.FINANCE_VIEW,
      PERMISSIONS.FINANCE_COLLECT_PAYMENT,
      PERMISSIONS.FINANCE_PAYOUTS,
      PERMISSIONS.FINANCE_EXPENSES,
    ],
  },
  { label: 'إدارة القاعات', to: '/classrooms', icon: Building2, permission: PERMISSIONS.CLASSROOMS_VIEW },
  {
    label: 'رسائل واتساب',
    to: '/whatsapp',
    icon: MessageCircle,
    anyPermissions: [
      PERMISSIONS.STUDENTS_VIEW,
      PERMISSIONS.GROUPS_VIEW,
      PERMISSIONS.ATTENDANCE_VIEW,
      PERMISSIONS.FINANCE_VIEW,
      PERMISSIONS.FINANCE_COLLECT_PAYMENT,
    ],
  },
  { label: 'التقويم الموحد', to: '/calendar', icon: Calendar, permission: PERMISSIONS.CALENDAR_VIEW },
  { label: 'التقارير التفصيلية', to: '/reports', icon: BarChart3, permission: PERMISSIONS.REPORTS_VIEW },
  {
    label: 'المستخدمون والصلاحيات',
    to: '/users',
    icon: ShieldCheck,
    anyPermissions: [PERMISSIONS.USERS_VIEW, PERMISSIONS.ROLES_MANAGE],
  },
  { label: 'سجل العمليات (Audit)', to: '/audit-logs', icon: ScrollText, permission: PERMISSIONS.AUDIT_VIEW },
  { label: 'النسخ الاحتياطي والأمان', to: '/backups', icon: Database, permission: PERMISSIONS.BACKUPS_VIEW },
  {
    label: 'إعدادات النظام',
    to: '/settings',
    icon: Settings,
    permission: PERMISSIONS.SETTINGS_MANAGE,
    requiredRole: SystemRole.OWNER,
  },
];

