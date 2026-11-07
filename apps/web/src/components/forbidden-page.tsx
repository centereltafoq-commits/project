import { useNavigate } from 'react-router-dom';
import { ArrowRight, Home, ShieldAlert } from 'lucide-react';
import { Button, Card, CardContent } from '@/design-system';

interface ForbiddenPageProps {
  permission?: string;
  message?: string;
}

export function ForbiddenPage({ permission, message }: ForbiddenPageProps) {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <Card className="w-full max-w-lg border-destructive/20 bg-card text-center shadow-lg">
        <CardContent className="space-y-6 p-8">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <ShieldAlert className="h-10 w-10 animate-bounce" />
          </div>

          <div className="space-y-2">
            <span className="inline-block rounded-full bg-destructive/10 px-3 py-1 text-xs font-mono font-bold text-destructive">
              خطأ 403 • محظور الوصول
            </span>
            <h2 className="text-xl font-extrabold text-foreground">
              غير مصرح بالدخول إلى هذه الشاشة
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {message ||
                'عذراً، حسابك الحالي لا يمتلك الصلاحيات الإدارية المطلوبة للوصول إلى محتويات هذه الصفحة.'}
            </p>
            {permission && (
              <p className="text-xs font-mono text-muted-foreground/80">
                رمز الصلاحية المطلوبة: <span className="font-bold text-destructive">{permission}</span>
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(-1)}
              className="gap-2"
            >
              <ArrowRight className="h-4 w-4" />
              الرجوع للخلف
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate('/')}
              className="gap-2"
            >
              <Home className="h-4 w-4" />
              الذهاب للرئيسية
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
