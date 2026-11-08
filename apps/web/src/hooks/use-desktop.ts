import * as React from 'react';

export interface DesktopConfig {
  serverMode: 'server' | 'client';
  serverUrl: string;
  defaultThermalPrinter?: string;
  directPrintEnabled: boolean;
  isFirstLaunch: boolean;
  windowBounds?: {
    width: number;
    height: number;
    x?: number;
    y?: number;
  };
}

export interface ServerStatus {
  running: boolean;
  pid?: number;
  port: number;
  uptime?: number;
  error?: string;
}

export interface PrinterInfo {
  name: string;
  displayName?: string;
  description?: string;
  status: number;
  isDefault: boolean;
}

export interface SilentPrintOptions {
  printerName?: string;
  htmlContent: string;
  width?: string;
}

export interface DesktopApi {
  isDesktop: boolean;
  platform: string;
  version: string;
  getConfig: () => Promise<DesktopConfig>;
  saveConfig: (config: Partial<DesktopConfig>) => Promise<DesktopConfig>;
  testConnection: (url: string) => Promise<{ ok: boolean; status?: number; error?: string }>;
  getLocalIps: () => Promise<string[]>;
  getServerStatus: () => Promise<ServerStatus>;
  startServer: () => Promise<{ success: boolean; error?: string }>;
  stopServer: () => Promise<{ success: boolean; error?: string }>;
  getPrinters: () => Promise<PrinterInfo[]>;
  printReceipt: (options: SilentPrintOptions) => Promise<{ success: boolean; error?: string }>;
}

declare global {
  interface Window {
    desktopApi?: DesktopApi;
  }
}

export function useDesktop() {
  const isDesktop = typeof window !== 'undefined' && Boolean(window.desktopApi?.isDesktop);
  const platform = isDesktop && window.desktopApi?.platform ? window.desktopApi.platform : 'web';

  const [config, setConfig] = React.useState<DesktopConfig | null>(null);
  const [serverStatus, setServerStatus] = React.useState<ServerStatus | null>(null);
  const [localIps, setLocalIps] = React.useState<string[]>([]);
  const [printers, setPrinters] = React.useState<PrinterInfo[]>([]);
  const [isLoading, setIsLoading] = React.useState<boolean>(isDesktop);

  const reloadPrinters = React.useCallback(async () => {
    if (!isDesktop || !window.desktopApi) return;
    try {
      const printerList = await window.desktopApi.getPrinters();
      setPrinters(printerList);
    } catch (e) {
      console.error('Failed to load desktop printers:', e);
    }
  }, [isDesktop]);

  const reloadServerStatus = React.useCallback(async () => {
    if (!isDesktop || !window.desktopApi) return;
    try {
      const status = await window.desktopApi.getServerStatus();
      setServerStatus(status);
    } catch (e) {
      console.error('Failed to get server status:', e);
    }
  }, [isDesktop]);

  React.useEffect(() => {
    if (!isDesktop || !window.desktopApi) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    Promise.all([
      window.desktopApi.getConfig(),
      window.desktopApi.getServerStatus(),
      window.desktopApi.getLocalIps(),
      window.desktopApi.getPrinters(),
    ])
      .then(([cfg, status, ips, printerList]) => {
        if (!isMounted) return;
        setConfig(cfg);
        setServerStatus(status);
        setLocalIps(ips);
        setPrinters(printerList);
      })
      .catch((err) => {
        console.error('Error initializing desktop integration:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isDesktop]);

  const saveConfig = React.useCallback(
    async (updates: Partial<DesktopConfig>): Promise<DesktopConfig | null> => {
      if (!isDesktop || !window.desktopApi) {
        return null;
      }
      try {
        const updated = await window.desktopApi.saveConfig(updates);
        setConfig(updated);
        return updated;
      } catch (err) {
        console.error('Failed to save desktop config:', err);
        throw err;
      }
    },
    [isDesktop],
  );

  const testConnection = React.useCallback(
    async (url: string) => {
      if (!isDesktop || !window.desktopApi) {
        return { ok: false, error: 'Not running in desktop app' };
      }
      return window.desktopApi.testConnection(url);
    },
    [isDesktop],
  );

  const startServer = React.useCallback(async () => {
    if (!isDesktop || !window.desktopApi) {
      return { success: false, error: 'Not running in desktop app' };
    }
    const res = await window.desktopApi.startServer();
    await reloadServerStatus();
    return res;
  }, [isDesktop, reloadServerStatus]);

  const stopServer = React.useCallback(async () => {
    if (!isDesktop || !window.desktopApi) {
      return { success: false, error: 'Not running in desktop app' };
    }
    const res = await window.desktopApi.stopServer();
    await reloadServerStatus();
    return res;
  }, [isDesktop, reloadServerStatus]);

  const printReceipt = React.useCallback(
    async (options: SilentPrintOptions) => {
      if (!isDesktop || !window.desktopApi) {
        return { success: false, error: 'Not running in desktop app' };
      }
      return window.desktopApi.printReceipt(options);
    },
    [isDesktop],
  );

  return {
    isDesktop,
    platform,
    config,
    serverStatus,
    localIps,
    printers,
    isLoading,
    saveConfig,
    testConnection,
    startServer,
    stopServer,
    printReceipt,
    reloadPrinters,
  };
}
