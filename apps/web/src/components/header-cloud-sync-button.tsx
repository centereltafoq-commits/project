import * as React from 'react';
import { QueryClientContext } from '@tanstack/react-query';
import { Cloud, CloudDownload, CloudUpload, Loader2 } from 'lucide-react';
import { SystemRole } from '@edu-center/shared';
import { cn } from '@/lib/cn';
import { useAuth } from '@/features/auth/auth-context';
import { CloudSyncStatusResponse } from '@/features/backups/cloud-sync-api';
import { useCloudSyncStatus } from '@/features/backups/use-cloud-sync';
import { CloudSyncModal } from './cloud-sync-modal';

interface HeaderCloudSyncTriggerProps {
  status?: CloudSyncStatusResponse;
  isLoading?: boolean;
  onClick: () => void;
}

function HeaderCloudSyncTrigger({
  status,
  isLoading,
  onClick,
}: HeaderCloudSyncTriggerProps) {
  const state = status?.state;

  const visual = React.useMemo(() => {
    if (state === 'REMOTE_NEWER' || state === 'CONFLICT') {
      return {
        btnClass:
          'border-amber-500/50 bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 font-bold',
        icon: <CloudDownload className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-300" />,
        label: status?.remoteLatest
          ? `سحب تعديلات جديدة (v${status.remoteLatest.version})`
          : 'سحب تعديلات السحابة',
        pulseDot: true,
      };
    }

    if (state === 'LOCAL_AHEAD') {
      return {
        btnClass:
          'border-primary/50 bg-primary/10 hover:bg-primary/20 text-primary font-bold',
        icon: <CloudUpload className="h-3.5 w-3.5 shrink-0" />,
        label: 'نشر التعديلات للسحابة',
        pulseDot: false,
      };
    }

    if (state === 'IN_SYNC') {
      return {
        btnClass:
          'border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-semibold',
        icon: <Cloud className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />,
        label: `متزامن (v${status?.lastSyncedVersion ?? 0})`,
        pulseDot: false,
      };
    }

    if (state === 'CONNECTION_ERROR') {
      return {
        btnClass:
          'border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 font-semibold',
        icon: <Cloud className="h-3.5 w-3.5 shrink-0" />,
        label: 'المزامنة السحابية (تنبيه اتصال)',
        pulseDot: false,
      };
    }

    return {
      btnClass:
        'border-border bg-card hover:bg-accent hover:text-accent-foreground text-foreground font-semibold',
      icon: isLoading ? (
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
      ) : (
        <Cloud className="h-3.5 w-3.5 shrink-0 text-primary" />
      ),
      label: 'نشر وسحب التعديلات',
      pulseDot: false,
    };
  }, [state, status?.remoteLatest, status?.lastSyncedVersion, isLoading]);

  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="header-cloud-sync-btn"
      title={
        status?.stateMessageAr ||
        'المزامنة السحابية عبر Supabase — نشر وسحب التعديلات بين الأجهزة'
      }
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-sm transition-colors',
        visual.btnClass,
      )}
    >
      {visual.pulseDot && (
        <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
      )}
      {visual.icon}
      <span className="hidden sm:inline whitespace-nowrap">{visual.label}</span>
    </button>
  );
}

function ConnectedHeaderCloudSyncButton() {
  const [modalOpen, setModalOpen] = React.useState(false);
  const { data: status, isLoading } = useCloudSyncStatus(true);

  return (
    <>
      <HeaderCloudSyncTrigger
        status={status}
        isLoading={isLoading}
        onClick={() => setModalOpen(true)}
      />
      {modalOpen && (
        <CloudSyncModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          defaultTab={status?.configured === false ? 'config' : 'sync'}
        />
      )}
    </>
  );
}

export function HeaderCloudSyncButton() {
  const { user } = useAuth();
  const queryClient = React.useContext(QueryClientContext);

  if (!user || user.roleCode === SystemRole.TEACHER) {
    return null;
  }

  if (!queryClient) {
    return <HeaderCloudSyncTrigger onClick={() => undefined} />;
  }

  return <ConnectedHeaderCloudSyncButton />;
}
