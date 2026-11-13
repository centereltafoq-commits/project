import * as React from 'react';
import { Navigate } from 'react-router-dom';
import { GraduationCap, Lock, Mail } from 'lucide-react';
import { Button, Card, Input, useToast } from '@/design-system';
import { extractErrorMessage } from '@/lib/api-client';
import { useCenterSettings } from '@/features/settings/center-settings-context';
import { useAuth } from './auth-context';

export function LoginPage() {
  const { user, login } = useAuth();
  const { settings } = useCenterSettings();
  const [logoError, setLogoError] = React.useState(false);
  const { notify } = useToast();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    setLogoError(false);
  }, [settings?.logoUrl]);

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSubmitting(true);
    try {
      await login(email, password);
      notify(`مرحباً بك في ${settings.centerName || 'نظام إدارة السنتر التعليمي'}`, 'success');
    } catch (err) {
      const msg = extractErrorMessage(err);
      setErrorMessage(msg);
      notify(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-4" dir="rtl">
      <Card className="w-full max-w-md border-white/10 bg-card/95 p-7 shadow-2xl backdrop-blur">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-primary text-primary-foreground shadow-lg">
            {settings.logoUrl && !logoError ? (
              <img
                src={settings.logoUrl}
                alt={settings.centerName}
                className="h-full w-full object-cover"
                onError={() => setLogoError(true)}
              />
            ) : (
              <GraduationCap className="h-8 w-8" />
            )}
          </div>
          <h1 className="text-2xl font-extrabold text-foreground">
            {settings.centerName || 'نظام إدارة السنتر التعليمي'}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {settings.centerSubtitle || 'منصة متكاملة لإدارة الطلاب والمدرسين والحسابات والمواعيد'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMessage && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-xs font-semibold text-destructive"
            >
              {errorMessage}
            </div>
          )}

          <div className="relative">
            <Input
              label="البريد الإلكتروني"
              type="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="admin@educenter.com"
            />
            <Mail className="pointer-events-none absolute left-3 top-9 h-4 w-4 text-muted-foreground" />
          </div>

          <div className="relative">
            <Input
              label="كلمة المرور"
              type="password"
              required
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="••••••••"
            />
            <Lock className="pointer-events-none absolute left-3 top-9 h-4 w-4 text-muted-foreground" />
          </div>

          <Button type="submit" className="w-full" size="lg" isLoading={submitting}>
            تسجيل الدخول إلى النظام
          </Button>
        </form>
      </Card>
    </div>
  );
}
