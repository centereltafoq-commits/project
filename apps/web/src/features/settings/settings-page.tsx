import * as React from 'react';
import {
  Building2,
  Save,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Phone,
  MapPin,
  Calendar,
  DollarSign,
  Image as ImageIcon,
} from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  PageHeader,
  useToast,
} from '@/design-system';
import { extractErrorMessage } from '@/lib/api-client';
import { settingsApi } from './settings-api';
import { useCenterSettings } from './center-settings-context';
import { NewAcademicYearModal } from './components/new-academic-year-modal';

export function SettingsPage() {
  const { toast } = useToast();
  const { settings, refetch, isLoading } = useCenterSettings();

  const [form, setForm] = React.useState({
    centerName: '',
    centerSubtitle: '',
    logoUrl: '',
    phone: '',
    address: '',
    academicYear: '',
    currencySymbol: '',
  });

  const [isSaving, setIsSaving] = React.useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = React.useState(false);
  const [logoPreviewError, setLogoPreviewError] = React.useState(false);

  React.useEffect(() => {
    if (settings) {
      setForm({
        centerName: settings.centerName || '',
        centerSubtitle: settings.centerSubtitle || '',
        logoUrl: settings.logoUrl || '',
        phone: settings.phone || '',
        address: settings.address || '',
        academicYear: settings.academicYear || '',
        currencySymbol: settings.currencySymbol || '',
      });
      setLogoPreviewError(false);
    }
  }, [settings]);

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === 'logoUrl') {
      setLogoPreviewError(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.centerName.trim()) {
      toast({
        title: 'حقل إجباري مفقود',
        description: 'اسم السنتر إجباري ولا يمكن تركه فارغاً.',
        tone: 'danger',
      });
      return;
    }

    try {
      setIsSaving(true);
      await settingsApi.updateSettings({
        centerName: form.centerName.trim(),
        centerSubtitle: form.centerSubtitle.trim() || undefined,
        logoUrl: form.logoUrl.trim() || undefined,
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
        academicYear: form.academicYear.trim() || undefined,
        currencySymbol: form.currencySymbol.trim() || undefined,
      });

      await refetch();
      toast({
        title: 'تم حفظ الإعدادات',
        description: 'تم تحديث هوية وبيانات السنتر بنجاح وانعكاسها على النظام.',
        tone: 'success',
      });
    } catch (err) {
      toast({
        title: 'فشل حفظ الإعدادات',
        description: extractErrorMessage(err),
        tone: 'danger',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="إعدادات النظام وهوية السنتر"
        description="تخصيص بيانات السنتر، الشعار، العام الدراسي، ومحرك بدء العام الدراسي الجديد"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Branding Settings Card (2 Cols) */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="border-b border-border">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                <CardTitle>إعدادات وهوية السنتر</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleSave} className="space-y-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input
                    label="اسم السنتر *"
                    placeholder="مثال: سنتر النخبة التعليمي"
                    value={form.centerName}
                    onChange={(e) => handleChange('centerName', e.target.value)}
                    disabled={isLoading || isSaving}
                    hint="يظهر في الشريط الجانبي والترويسة والمطبوعات"
                  />
                  <Input
                    label="الوصف أو الشعار النصي"
                    placeholder="مثال: نظام الإدارة المتكامل"
                    value={form.centerSubtitle}
                    onChange={(e) => handleChange('centerSubtitle', e.target.value)}
                    disabled={isLoading || isSaving}
                  />
                </div>

                {/* Logo and Live Preview */}
                <div className="space-y-2">
                  <Input
                    label="رابط الشعار (Logo URL)"
                    placeholder="https://example.com/logo.png أو مسار نسبي"
                    value={form.logoUrl}
                    onChange={(e) => handleChange('logoUrl', e.target.value)}
                    disabled={isLoading || isSaving}
                    hint="رابط صورة الشعار بصيغة PNG أو JPG أو SVG"
                  />
                  {form.logoUrl.trim() !== '' && (
                    <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-card">
                        {!logoPreviewError ? (
                          <img
                            src={form.logoUrl}
                            alt="Logo Preview"
                            className="h-full w-full object-contain"
                            onError={() => setLogoPreviewError(true)}
                          />
                        ) : (
                          <ImageIcon className="h-6 w-6 text-muted-foreground" />
                        )}
                      </div>
                      <div className="text-xs">
                        <p className="font-semibold text-foreground">
                          {logoPreviewError ? 'تعذر تحميل معاينة الصورة' : 'معاينة الشعار الحالية'}
                        </p>
                        <p className="text-muted-foreground">
                          {logoPreviewError
                            ? 'يرجى التأكد من صحة الرابط وامتداد الصورة'
                            : 'سيظهر هذا الشعار أعلى الإيصالات والتقارير والشريط الجانبي'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="relative">
                    <Input
                      label="رقم هاتف السنتر"
                      placeholder="مثال: 01000000000"
                      value={form.phone}
                      onChange={(e) => handleChange('phone', e.target.value)}
                      disabled={isLoading || isSaving}
                      hint="يظهر في أسفل الإيصالات المطبوعة"
                    />
                  </div>
                  <Input
                    label="عنوان مقر السنتر"
                    placeholder="مثال: القاهرة، مدينة نصر"
                    value={form.address}
                    onChange={(e) => handleChange('address', e.target.value)}
                    disabled={isLoading || isSaving}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input
                    label="العام الدراسي النشط"
                    placeholder="مثال: 2026 / 2027"
                    value={form.academicYear}
                    onChange={(e) => handleChange('academicYear', e.target.value)}
                    disabled={isLoading || isSaving}
                    hint="العام الدراسي الافتراضي المسجل بالتقارير"
                  />
                  <Input
                    label="رمز العملة"
                    placeholder="مثال: ج.م"
                    value={form.currencySymbol}
                    onChange={(e) => handleChange('currencySymbol', e.target.value)}
                    disabled={isLoading || isSaving}
                  />
                </div>

                <div className="flex justify-end pt-3">
                  <Button
                    type="submit"
                    variant="primary"
                    isLoading={isSaving}
                    disabled={isLoading || isSaving}
                  >
                    <Save className="h-4 w-4" />
                    <span>حفظ التعديلات</span>
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Info & Danger Zone Card (1 Col) */}
        <div className="space-y-6">
          {/* Identity Snapshot Card */}
          <Card className="bg-gradient-to-br from-card to-muted/20">
            <CardHeader className="border-b border-border">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm">ملخص هوية السنتر</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-3 text-xs">
              <div className="flex items-center gap-2 text-foreground font-semibold">
                <Building2 className="h-4 w-4 text-primary shrink-0" />
                <span>{form.centerName || 'سنتر النخبة التعليمي'}</span>
              </div>
              {form.centerSubtitle && (
                <p className="text-muted-foreground pr-6">{form.centerSubtitle}</p>
              )}
              {form.phone && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  <span dir="ltr">{form.phone}</span>
                </div>
              )}
              {form.address && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span>{form.address}</span>
                </div>
              )}
              {form.academicYear && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5 shrink-0" />
                  <span>العام الدراسي: {form.academicYear}</span>
                </div>
              )}
              {form.currencySymbol && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <DollarSign className="h-3.5 w-3.5 shrink-0" />
                  <span>العملة: {form.currencySymbol}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Danger Zone Card */}
          <Card className="border-destructive/40 bg-destructive/5 shadow-sm">
            <CardHeader className="border-b border-destructive/20">
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                <CardTitle className="text-destructive font-bold">
                  منطقة العمليات الحساسة (Danger Zone)
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="space-y-2 text-xs leading-relaxed text-foreground">
                <p className="font-semibold text-destructive">
                  بدء سنة دراسية جديدة والتصفير الأرشيفي
                </p>
                <p className="text-muted-foreground">
                  تتيح هذه العملية إنهاء العام الدراسي الحالي بتوليد نسخة احتياطية أرشيفية كاملة
                  مؤرخة، ثم تصفير الحصص وسجلات الحضور والغياب وكافة الحسابات والمدفوعات لتجهيز
                  السنتر للعام القادم بأمان مطلق.
                </p>
              </div>

              <div className="rounded-lg border border-destructive/20 bg-background/80 p-3 text-xs text-muted-foreground">
                🔒 العملية محمية بكلمة سر PIN مكونة من 6 أرقام مع ضمانة عدم المساس بحسابات النظام
                والصلاحيات والقاعات.
              </div>

              <Button
                type="button"
                variant="danger"
                className="w-full gap-2"
                onClick={() => setIsResetModalOpen(true)}
              >
                <RotateCcw className="h-4 w-4" />
                <span>بدء سنة دراسية جديدة والتصفير</span>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* New Academic Year Danger Modal */}
      <NewAcademicYearModal
        open={isResetModalOpen}
        onOpenChange={setIsResetModalOpen}
      />
    </div>
  );
}
