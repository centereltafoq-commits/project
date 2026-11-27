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
  Upload,
  UploadCloud,
  Trash2,
  Link2,
  Loader2,
  Printer,
  RefreshCw,
  Server,
  Power,
  Cloud,
  Settings2,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  PageHeader,
  useToast,
} from '@/design-system';
import { cn } from '@/lib/cn';
import { extractErrorMessage } from '@/lib/api-client';
import { useDesktop } from '@/hooks/use-desktop';
import { DesktopUpdatePanel } from '@/components/desktop-update-panel';
import { CloudSyncModal } from '@/components/cloud-sync-modal';
import { useCloudSyncStatus } from '@/features/backups/use-cloud-sync';
import { settingsApi } from './settings-api';
import { useCenterSettings } from './center-settings-context';
import { NewAcademicYearModal } from './components/new-academic-year-modal';

export function SettingsPage() {
  const { notify } = useToast();
  const { settings, refetch, isLoading } = useCenterSettings();
  const {
    isDesktop,
    config,
    serverStatus,
    printers,
    saveConfig,
    startServer,
    stopServer,
    reloadPrinters,
  } = useDesktop();

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
  const [cloudSyncModalOpen, setCloudSyncModalOpen] = React.useState(false);
  const [cloudSyncTab, setCloudSyncTab] = React.useState<'sync' | 'config'>('config');
  const { data: cloudSyncStatus } = useCloudSyncStatus(true);
  const [logoPreviewError, setLogoPreviewError] = React.useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = React.useState(false);
  const [isDragOver, setIsDragOver] = React.useState(false);
  const [showManualUrl, setShowManualUrl] = React.useState(false);

  const logoInputRef = React.useRef<HTMLInputElement>(null);

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

  const readFileHeaderBytes = async (file: File): Promise<Uint8Array | null> => {
    const slice = typeof file.slice === 'function' ? file.slice(0, 512) : file;
    if (typeof slice.arrayBuffer === 'function') {
      return new Uint8Array(await slice.arrayBuffer());
    }
    if (typeof FileReader !== 'undefined') {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          resolve(
            reader.result instanceof ArrayBuffer
              ? new Uint8Array(reader.result)
              : null,
          );
        };
        reader.onerror = () => resolve(null);
        reader.readAsArrayBuffer(slice);
      });
    }
    return null;
  };

  const hasValidLogoHeader = async (file: File): Promise<boolean> => {
    try {
      const bytes = await readFileHeaderBytes(file);
      if (!bytes || bytes.length < 4) return false;

      const name = file.name.toLowerCase();
      if (file.type === 'image/svg+xml' || name.endsWith('.svg')) {
        const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
        return /<svg[\s>]/i.test(text);
      }

      const isPng =
        bytes.length >= 8 &&
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47 &&
        bytes[4] === 0x0d &&
        bytes[5] === 0x0a &&
        bytes[6] === 0x1a &&
        bytes[7] === 0x0a;
      const isJpg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
      const isGif =
        bytes.length >= 6 &&
        bytes[0] === 0x47 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x38;
      const isWebp =
        bytes.length >= 12 &&
        bytes[0] === 0x52 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x46 &&
        bytes[8] === 0x57 &&
        bytes[9] === 0x45 &&
        bytes[10] === 0x42 &&
        bytes[11] === 0x50;

      return isPng || isJpg || isGif || isWebp;
    } catch {
      return false;
    }
  };

  const uploadLogoFile = async (file: File) => {
    if (!file.type.startsWith('image/') && !file.name.match(/\.(png|jpe?g|webp|svg|gif)$/i)) {
      notify('نوع الملف غير مدعوم. يرجى اختيار ملف صورة صالح (PNG, JPG, WEBP, SVG)', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      notify('حجم ملف الصورة كبير جداً. الحد الأقصى المسموح هو 5 ميجابايت', 'error');
      return;
    }
    if (!(await hasValidLogoHeader(file))) {
      notify('ملف الصورة تالف أو لا يطابق صيغة الصورة المختارة', 'error');
      return;
    }

    try {
      setIsUploadingLogo(true);
      const result = await settingsApi.uploadLogo(file);
      handleChange('logoUrl', result.logoUrl);
      await refetch();
      notify('تم رفع الشعار وتحديث النظام بنجاح', 'success');
    } catch (err: any) {
      notify(extractErrorMessage(err), 'error');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleLogoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadLogoFile(file);
    }
    e.target.value = '';
  };

  const handleLogoDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      uploadLogoFile(file);
    }
  };

  const handleRemoveLogo = async () => {
    try {
      setIsSaving(true);
      if (settings?.logoUrl) {
        await settingsApi.removeLogo();
      }
      handleChange('logoUrl', '');
      await refetch();
      notify('تم حذف شعار السنتر بنجاح', 'success');
    } catch (err: any) {
      notify(extractErrorMessage(err), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.centerName.trim()) {
      notify('اسم السنتر إجباري ولا يمكن تركه فارغاً', 'error');
      return;
    }

    const trimmedPhone = form.phone.trim();
    if (trimmedPhone && !/^(?=(?:.*\d){7,15})[+\d\s\-()]{7,20}$/.test(trimmedPhone)) {
      notify('رقم الهاتف غير صالح، يجب أن يحتوي على أرقام صالحة (7 إلى 15 رقماً)', 'error');
      return;
    }

    const trimmedYear = form.academicYear.trim();
    const yearMatch = /^(\d{4})\s*[\/\-]\s*(\d{4})$/.exec(trimmedYear);
    if (
      !yearMatch ||
      Number(yearMatch[1]) < 2000 ||
      Number(yearMatch[1]) > 2099 ||
      Number(yearMatch[2]) !== Number(yearMatch[1]) + 1
    ) {
      notify('صيغة العام الدراسي غير صالحة، يجب أن تكون عامين متتاليين مثل: 2026 / 2027', 'error');
      return;
    }

    const trimmedLogo = form.logoUrl.trim();
    if (trimmedLogo && !/^(https?:\/\/[^\s]+|\/api\/settings\/logo\/[^\s]+)$/i.test(trimmedLogo)) {
      notify('رابط الشعار غير صالح، يجب أن يبدأ بـ http:// أو https:// أو مسار شعار النظام', 'error');
      return;
    }

    try {
      setIsSaving(true);
      await settingsApi.updateSettings({
        centerName: form.centerName.trim(),
        centerSubtitle: form.centerSubtitle.trim() || null,
        logoUrl: trimmedLogo || null,
        phone: trimmedPhone || null,
        address: form.address.trim() || null,
        academicYear: `${yearMatch[1]} / ${yearMatch[2]}`,
        currencySymbol: form.currencySymbol.trim() || undefined,
      });

      await refetch();
      notify('تم تحديث هوية وبيانات السنتر بنجاح وانعكاسها على النظام', 'success');
    } catch (err) {
      notify(extractErrorMessage(err), 'error');
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

                {/* Center Logo Upload and Live Preview */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-foreground">
                      شعار السنتر (Logo)
                    </label>
                    {form.logoUrl.trim() !== '' && (
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        disabled={isUploadingLogo || isLoading || isSaving}
                        className="flex items-center gap-1 text-xs font-semibold text-destructive hover:underline"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>إزالة الشعار</span>
                      </button>
                    )}
                  </div>

                  <input
                    ref={logoInputRef}
                    type="file"
                    data-testid="logo-file-input"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
                    onChange={handleLogoFileSelect}
                    className="hidden"
                  />

                  {/* Active Logo Display */}
                  {form.logoUrl.trim() !== '' ? (
                    <div className="flex flex-col sm:flex-row items-center gap-4 rounded-xl border border-border bg-card p-4">
                      <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/40 shadow-sm">
                        {!logoPreviewError ? (
                          <img
                            src={form.logoUrl}
                            alt="Logo Preview"
                            className="h-full w-full object-contain p-1"
                            onError={() => setLogoPreviewError(true)}
                          />
                        ) : (
                          <ImageIcon className="h-8 w-8 text-muted-foreground" />
                        )}
                      </div>

                      <div className="flex-1 space-y-1 text-center sm:text-right">
                        <p className="text-sm font-bold text-foreground">
                          {logoPreviewError ? 'تعذر تحميل معاينة الصورة' : 'شعار السنتر الحالي'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {logoPreviewError
                            ? 'يرجى رفع ملف صورة صالح أو التأكد من سلامة الرابط'
                            : 'يظهر الشعار تلقائياً أعلى الإيصالات المطبوعة والتقارير والشريط الجانبي'}
                        </p>
                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => logoInputRef.current?.click()}
                            disabled={isUploadingLogo || isLoading || isSaving}
                            className="gap-1.5 text-xs"
                          >
                            {isUploadingLogo ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Upload className="h-3.5 w-3.5 text-primary" />
                            )}
                            <span>تغيير صورة الشعار</span>
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleRemoveLogo}
                            disabled={isUploadingLogo || isLoading || isSaving}
                            className="gap-1.5 text-xs text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>حذف الشعار</span>
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Dropzone when no logo is set */
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragOver(true);
                      }}
                      onDragLeave={() => setIsDragOver(false)}
                      onDrop={handleLogoDrop}
                      onClick={() => logoInputRef.current?.click()}
                      className={cn(
                        'group relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-all cursor-pointer',
                        isDragOver
                          ? 'border-primary bg-primary/5'
                          : 'border-border bg-muted/20 hover:border-primary/50 hover:bg-muted/40',
                        isUploadingLogo && 'pointer-events-none opacity-60',
                      )}
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-2 transition-transform group-hover:scale-110">
                        {isUploadingLogo ? (
                          <Loader2 className="h-6 w-6 animate-spin" />
                        ) : (
                          <UploadCloud className="h-6 w-6" />
                        )}
                      </div>

                      <p className="text-sm font-bold text-foreground">
                        {isUploadingLogo
                          ? 'جاري رفع صورة الشعار وتحديث النظام...'
                          : 'اسحب صورة الشعار وأفلتها هنا، أو اضغط للاختيار من الكمبيوتر'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        يدعم صيغ PNG, JPG, WEBP, SVG (أقصى حجم 5 ميجابايت)
                      </p>
                    </div>
                  )}

                  {/* Optional Manual URL fallback */}
                  <div className="pt-1">
                    {!showManualUrl ? (
                      <button
                        type="button"
                        onClick={() => setShowManualUrl(true)}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Link2 className="h-3.5 w-3.5" />
                        <span>أو إدخال رابط صورة يدوي (URL) بدلاً من الرفع</span>
                      </button>
                    ) : (
                      <div className="space-y-1.5 rounded-lg border border-border bg-muted/20 p-3">
                        <Input
                          label="رابط الشعار المباشر (Logo URL)"
                          placeholder="https://example.com/logo.png"
                          value={form.logoUrl}
                          onChange={(e) => handleChange('logoUrl', e.target.value)}
                          disabled={isLoading || isSaving}
                          hint="إذا كنت تفضل استخدام صورة مستضافة على خادم خارجي"
                        />
                      </div>
                    )}
                  </div>
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

          {/* Dedicated Desktop & Hardware Card */}
          {isDesktop && (
            <Card className="border-primary/40 shadow-sm">
              <CardHeader className="border-b border-border">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Printer className="h-5 w-5 text-primary" />
                    <CardTitle>إعدادات أجهزة السنتر والطباعة الحرارية (Desktop & Hardware)</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                {/* Thermal Printer Settings */}
                <div className="space-y-4 rounded-xl border border-border bg-muted/10 p-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-foreground">طابعة الإيصالات الحرارية (Thermal POS Printer)</h4>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={reloadPrinters}
                      className="h-8 gap-1 text-xs text-muted-foreground"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>تحديث قائمة الطابعات</span>
                    </Button>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="thermal-printer-select" className="text-xs font-semibold text-muted-foreground block">
                      طابعة إيصالات السداد الحرارية الافتراضية
                    </label>
                    <select
                      id="thermal-printer-select"
                      aria-label="طابعة إيصالات السداد الحرارية الافتراضية"
                      value={config?.defaultThermalPrinter || ''}
                      onChange={async (e) => {
                        const val = e.target.value;
                        try {
                          await saveConfig({ defaultThermalPrinter: val });
                          notify('تم حفظ طابعة الإيصالات الافتراضية بنجاح', 'success');
                        } catch {
                          notify('فشل حفظ إعدادات الطابعة', 'error');
                        }
                      }}
                      className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">(طابعة النظام الافتراضية)</option>
                      {printers.map((p) => (
                        <option key={p.name} value={p.name}>
                          {p.displayName || p.name} {p.isDefault ? '★ (افتراضية ويندوز)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Direct Silent Printing Toggle */}
                  <label className="flex items-start gap-3 cursor-pointer select-none rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted/20">
                    <input
                      type="checkbox"
                      aria-label="تفعيل الطباعة الصامتة المباشرة لإيصالات السداد (بدون نافذة المتصفح)"
                      checked={Boolean(config?.directPrintEnabled)}
                      onChange={async (e) => {
                        const checked = e.target.checked;
                        try {
                          await saveConfig({ directPrintEnabled: checked });
                          notify('تم تحديث وضع الطباعة المباشرة', 'success');
                        } catch {
                          notify('فشل حفظ وضع الطباعة', 'error');
                        }
                      }}
                      className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                    />
                    <div>
                      <span className="text-xs font-bold text-foreground block">
                        تفعيل الطباعة الصامتة المباشرة لإيصالات السداد (بدون نافذة المتصفح)
                      </span>
                      <span className="text-[11px] text-muted-foreground block mt-0.5">
                        إرسال الإيصال المالي مقاس 80 مم فوراً إلى الطابعة الحرارية مباشرة دون فتح نافذة الطباعة المنبثقة.
                      </span>
                    </div>
                  </label>
                </div>

                {/* Local Server Status Section */}
                <div className="space-y-4 rounded-xl border border-border bg-muted/10 p-4">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div className="flex items-center gap-2">
                      <Server className="h-4 w-4 text-primary" />
                      <h4 className="text-sm font-bold text-foreground">حالة الخادم المحلي وقاعدة البيانات</h4>
                    </div>
                    <Badge variant={serverStatus?.running ? 'success' : 'danger'}>
                      {serverStatus?.running ? `يعمل (منفذ ${serverStatus.port || 4000})` : 'متوقف'}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant={serverStatus?.running ? 'outline' : 'primary'}
                      size="sm"
                      onClick={async () => {
                        try {
                          await startServer();
                          notify('تم تشغيل/إعادة تشغيل السيرفر بنجاح', 'success');
                        } catch {
                          notify('فشل بدء تشغيل السيرفر', 'error');
                        }
                      }}
                      className="gap-1.5 text-xs"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>إعادة تشغيل السيرفر</span>
                    </Button>

                    {serverStatus?.running && (
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        onClick={async () => {
                          try {
                            await stopServer();
                            notify('تم إيقاف السيرفر', 'info');
                          } catch {
                            notify('فشل إيقاف السيرفر', 'error');
                          }
                        }}
                        className="gap-1.5 text-xs"
                      >
                        <Power className="h-3.5 w-3.5" />
                        <span>إيقاف السيرفر</span>
                      </Button>
                    )}
                  </div>
                </div>

                {/* System Tray, Auto-Start & GitHub Releases Auto-Update */}
                <DesktopUpdatePanel />
              </CardContent>
            </Card>
          )}
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

          {/* Supabase Cloud Sync Setup Card */}
          <Card className="border-blue-500/30 bg-blue-500/5 shadow-sm">
            <CardHeader className="border-b border-blue-500/20">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-primary">
                  <Cloud className="h-5 w-5" />
                  <CardTitle className="text-sm font-bold">
                    المزامنة السحابية عبر Supabase
                  </CardTitle>
                </div>
                <Badge variant={cloudSyncStatus?.configured ? 'success' : 'neutral'}>
                  {cloudSyncStatus?.configured ? 'متصل بالسحابة' : 'غير مربوط'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-3 text-xs">
              <p className="text-muted-foreground leading-relaxed">
                اربط البرنامج بحساب Supabase المجاني لنشر تعديلات الأسستنت آخر اليوم وسحبها على جهاز المدير من أي مكان وبحماية كاملة للبيانات.
              </p>
              {cloudSyncStatus?.configured && (
                <div className="rounded-lg border border-border bg-card p-2.5 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">الجهاز:</span>
                    <span className="font-bold text-foreground">{cloudSyncStatus.deviceName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">الإصدار المتزامن:</span>
                    <span className="font-mono font-bold text-foreground">
                      {cloudSyncStatus.lastSyncedVersion > 0
                        ? `v${cloudSyncStatus.lastSyncedVersion}`
                        : 'لم يتزامن بعد'}
                    </span>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    setCloudSyncTab('config');
                    setCloudSyncModalOpen(true);
                  }}
                >
                  <Settings2 className="h-3.5 w-3.5 text-primary" />
                  <span>إعدادات الربط بـ Supabase</span>
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    setCloudSyncTab('sync');
                    setCloudSyncModalOpen(true);
                  }}
                >
                  <Cloud className="h-3.5 w-3.5" />
                  <span>نشر وسحب التعديلات</span>
                </Button>
              </div>
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

      {/* Supabase Cloud Sync Modal */}
      <CloudSyncModal
        open={cloudSyncModalOpen}
        onOpenChange={setCloudSyncModalOpen}
        defaultTab={cloudSyncTab}
      />
    </div>
  );
}
