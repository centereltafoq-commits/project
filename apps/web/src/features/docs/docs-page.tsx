import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  Building2,
  Calendar,
  CalendarCheck2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Coins,
  Database,
  ExternalLink,
  GraduationCap,
  HelpCircle,
  Home,
  KeyRound,
  LayoutDashboard,
  LucideIcon,
  Moon,
  Printer,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  UserCheck,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { Badge, Button, Input } from '@/design-system';
import { cn } from '@/lib/cn';
import { printDocGuideA4 } from '@/lib/print-service';
import { DocSection, SYSTEM_DOCUMENTATION } from './docs-data';

const ICON_MAP: Record<string, LucideIcon> = {
  Sparkles,
  LayoutDashboard,
  GraduationCap,
  UserCheck,
  Users,
  BookOpen,
  ClipboardCheck,
  RotateCcw,
  Building2,
  Calendar,
  CalendarCheck2,
  Wallet,
  Coins,
  BarChart3,
  Settings,
  Database,
  ShieldCheck,
  HelpCircle,
};

export function DocsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = React.useState('');
  const [selectedId, setSelectedId] = React.useState<string>(SYSTEM_DOCUMENTATION[0]!.id);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  // Sync theme with system
  const [dark, setDark] = React.useState(() => {
    try {
      return typeof localStorage !== 'undefined'
        ? localStorage.getItem('edu_theme') === 'dark'
        : false;
    } catch {
      return false;
    }
  });

  React.useEffect(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('edu_theme', dark ? 'dark' : 'light');
      }
      if (dark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch {
      // ignore
    }
  }, [dark]);

  // Group sections by category
  const categories = React.useMemo(() => {
    const map = new Map<string, DocSection[]>();
    for (const doc of SYSTEM_DOCUMENTATION) {
      const list = map.get(doc.category) ?? [];
      list.push(doc);
      map.set(doc.category, list);
    }
    return Array.from(map.entries());
  }, []);

  // Filtered sections by search
  const filteredSections = React.useMemo(() => {
    if (!search.trim()) return SYSTEM_DOCUMENTATION;
    const q = search.trim().toLowerCase();
    return SYSTEM_DOCUMENTATION.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.summary.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q) ||
        d.keyFeatures.some(
          (f) => f.title.toLowerCase().includes(q) || f.description.toLowerCase().includes(q),
        ) ||
        d.workflowSteps.some(
          (s) => s.title.toLowerCase().includes(q) || s.description.toLowerCase().includes(q),
        ) ||
        d.businessRules.some((r) => r.toLowerCase().includes(q)),
    );
  }, [search]);

  // Active section
  const activeSection = React.useMemo(() => {
    return (
      SYSTEM_DOCUMENTATION.find((d) => d.id === selectedId) ||
      filteredSections[0] ||
      SYSTEM_DOCUMENTATION[0]!
    );
  }, [selectedId, filteredSections]);

  const currentIndex = SYSTEM_DOCUMENTATION.findIndex((d) => d.id === activeSection.id);
  const prevSection = currentIndex > 0 ? SYSTEM_DOCUMENTATION[currentIndex - 1] : null;
  const nextSection =
    currentIndex < SYSTEM_DOCUMENTATION.length - 1 ? SYSTEM_DOCUMENTATION[currentIndex + 1] : null;

  const safeScrollTop = () => {
    if (
      typeof window !== 'undefined' &&
      typeof window.scrollTo === 'function' &&
      !window.navigator.userAgent.includes('jsdom')
    ) {
      try {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch {
        // ignore
      }
    }
  };

  const ActiveIcon = ICON_MAP[activeSection.iconName] || BookOpen;

  const handlePrintDoc = async () => {
    await printDocGuideA4(activeSection);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col" dir="rtl">
      {/* Top Sticky Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Right Brand info in RTL */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm sm:text-base text-foreground tracking-tight">
                  دليل وتوثيق صفحات النظام
                </span>
                <Badge variant="purple" className="hidden sm:inline-flex text-[10px] py-0 px-2 font-bold">
                  مركز المعرفة
                </Badge>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>تم الإنشاء والتطوير بواسطة</span>
                <span className="font-extrabold text-foreground">nazzem edu</span>
              </div>
            </div>
          </div>

          {/* Left Actions in RTL: Back to System, Theme, Print */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrintDoc}
              className="hidden md:inline-flex items-center gap-1.5 text-xs no-print"
              title="طباعة الدليل A4"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>طباعة</span>
            </Button>

            <Button
              variant="outline"
              size="icon"
              onClick={() => setDark((d) => !d)}
              title={dark ? 'الوضع الفاتح' : 'الوضع الداكن'}
              className="h-9 w-9"
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            {/* Back to System Button */}
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-3.5 py-2 text-xs sm:text-sm font-bold text-primary-foreground shadow-sm hover:bg-primary/90 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              title="الرجوع إلى شاشة النظام الرئيسية"
              data-testid="back-to-system-btn"
            >
              <ArrowRight className="h-4 w-4 shrink-0" />
              <span>الرجوع للنظام</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Documentation Container */}
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col lg:flex-row">
        {/* Sidebar: Navigation across 15 Modules */}
        <aside className="w-full lg:w-80 shrink-0 border-b lg:border-b-0 lg:border-l border-border bg-card/50 p-4 lg:p-6 lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:overflow-y-auto space-y-5">
          {/* Search Box */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground">البحث السريع في الدليل</label>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث في شروحات الصفحات، المزايا، أو القواعد..."
                className="pr-9 text-xs"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {search && (
              <p className="text-[11px] text-muted-foreground">
                نتائج البحث: {filteredSections.length} من {SYSTEM_DOCUMENTATION.length} صفحة
              </p>
            )}
          </div>

          {/* Module Categories List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold px-1">
              <span>صفحات وأقسام النظام</span>
              <span className="font-mono text-[11px]">
                ({filteredSections.length}/{SYSTEM_DOCUMENTATION.length})
              </span>
            </div>

            <div className="space-y-3">
              {categories.map(([category, docs]) => {
                const categoryDocs = docs.filter((d) => filteredSections.some((f) => f.id === d.id));
                if (categoryDocs.length === 0) return null;

                return (
                  <div key={category} className="space-y-1">
                    <span className="px-2 text-[11px] font-bold text-muted-foreground tracking-wide">
                      {category}
                    </span>
                    <div className="space-y-0.5">
                      {categoryDocs.map((section) => {
                        const Icon = ICON_MAP[section.iconName] || BookOpen;
                        const isSelected = activeSection.id === section.id;

                        return (
                          <button
                            key={section.id}
                            type="button"
                            onClick={() => {
                              setSelectedId(section.id);
                              safeScrollTop();
                            }}
                            className={cn(
                              'group flex w-full items-center justify-between rounded-xl px-3 py-2 text-right text-xs font-semibold transition-all',
                              isSelected
                                ? 'bg-primary text-primary-foreground shadow-sm font-bold'
                                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                            )}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <Icon
                                className={cn(
                                  'h-4 w-4 shrink-0 transition-colors',
                                  isSelected
                                    ? 'text-primary-foreground'
                                    : 'text-muted-foreground group-hover:text-primary',
                                )}
                              />
                              <span className="truncate">{section.title}</span>
                            </div>
                            {section.badge && !isSelected && (
                              <Badge variant="neutral" className="text-[9px] py-0 px-1.5 shrink-0">
                                {section.badge}
                              </Badge>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Creator Card */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 text-primary font-bold">
              <Sparkles className="h-4 w-4" />
              <span>منظومة Nazzem Edu</span>
            </div>
            <p className="text-muted-foreground leading-relaxed text-[11px]">
              نظام إدارة محاسبي وأكاديمي متكامل مصمم خصيصاً للسناتر والمراكز التعليمية، لربط الحضور والغياب بالتحصيل المالي وعمولات المدرسين بدقة متناهية.
            </p>
          </div>
        </aside>

        {/* Content Viewer Panel */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 space-y-6">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-6">
            {/* Header info */}
            <div className="border-b border-border pb-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm">
                    <ActiveIcon className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-primary">{activeSection.category}</span>
                      {activeSection.badge && <Badge variant="info">{activeSection.badge}</Badge>}
                    </div>
                    <h1 className="text-xl font-extrabold text-foreground sm:text-2xl">
                      {activeSection.title}
                    </h1>
                  </div>
                </div>

                <Link
                  to={activeSection.pageRoute}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90 transition-all shrink-0 no-print"
                >
                  <span>الانتقال للصفحة في النظام</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
              <p className="mt-3 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {activeSection.summary}
              </p>
            </div>

            {/* Section 1: Purpose & Objectives */}
            <div className="space-y-3">
              <h2 className="text-sm font-extrabold text-foreground flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                الأهداف والمهام الرئيسية للصفحة
              </h2>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {activeSection.purpose.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2.5 rounded-xl border border-border/80 bg-muted/20 p-3 text-xs"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                    <span className="text-muted-foreground leading-relaxed">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 2: Key Interactive Features */}
            <div className="space-y-3">
              <h2 className="text-sm font-extrabold text-foreground flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                أهم العناصر والميزات التفاعلية
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {activeSection.keyFeatures.map((feat, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-border bg-card p-3.5 shadow-sm space-y-1 hover:border-primary/40 transition-colors"
                  >
                    <h3 className="text-xs font-bold text-foreground">{feat.title}</h3>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {feat.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 3: Step-by-Step Operating Workflow */}
            <div className="space-y-3">
              <h2 className="text-sm font-extrabold text-foreground flex items-center gap-2">
                <ArrowRight className="h-4 w-4 text-blue-500" />
                دليل الاستخدام والتشغيل خطوة بخطوة (Workflow)
              </h2>
              <div className="space-y-2.5">
                {activeSection.workflowSteps.map((step) => (
                  <div
                    key={step.stepNumber}
                    className="flex items-start gap-3 rounded-xl border border-border bg-muted/20 p-3 text-xs"
                  >
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-extrabold text-primary-foreground shadow-sm">
                      {step.stepNumber}
                    </div>
                    <div className="space-y-1">
                      <p className="font-bold text-foreground">{step.title}</p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 4: Business Rules & Caveats */}
            <div className="space-y-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
              <h2 className="text-xs font-extrabold text-amber-700 dark:text-amber-400 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                قواعد العمل والتنبيهات المحاسبية الهامة (Business Rules)
              </h2>
              <ul className="space-y-1.5 text-xs text-amber-900 dark:text-amber-200">
                {activeSection.businessRules.map((rule, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-[11px] leading-relaxed">
                    <span className="font-bold text-amber-600 shrink-0">•</span>
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Section 5: Permissions & RBAC */}
            <div className="space-y-2 pt-2 border-t border-border flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <KeyRound className="h-3.5 w-3.5 text-primary" />
                <span className="font-bold">الصلاحيات المطلوبة لهذه الصفحة:</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {activeSection.permissions.map((perm, idx) => (
                  <Badge key={idx} variant="neutral" className="text-[10px]">
                    {perm}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Bottom Next/Previous Paging Navigation */}
            <div className="pt-4 border-t border-border flex items-center justify-between gap-4 no-print">
              {prevSection ? (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(prevSection.id);
                    safeScrollTop();
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-bold text-foreground hover:bg-accent transition-colors"
                >
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <div className="text-right">
                    <div className="text-[10px] text-muted-foreground font-normal">القسم السابق</div>
                    <div className="truncate max-w-[140px] sm:max-w-[200px]">{prevSection.title}</div>
                  </div>
                </button>
              ) : (
                <div />
              )}

              {nextSection ? (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(nextSection.id);
                    safeScrollTop();
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-bold text-foreground hover:bg-accent transition-colors"
                >
                  <div className="text-left">
                    <div className="text-[10px] text-muted-foreground font-normal">القسم التالي</div>
                    <div className="truncate max-w-[140px] sm:max-w-[200px]">{nextSection.title}</div>
                  </div>
                  <ArrowLeft className="h-4 w-4 text-muted-foreground" />
                </button>
              ) : (
                <div />
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
