import type { DesktopConfig, DesktopUpdateSettings } from '../main/store-manager';
import type { ServerStatus } from '../main/server-manager';
import type { PrinterInfo, SilentPrintOptions } from '../main/printer-manager';
import type { DiscoveredServer } from '../main/lan-discovery';
import type { FirewallConfigResult } from '../main/firewall-utils';
import type { DesktopUpdateStatus } from '../main/update-manager';

/**
 * Whitelist of all IPC channels exposed between Electron Main process and Preload script.
 */
export const DESKTOP_CHANNELS = {
  GET_CONFIG: 'desktop:get-config',
  SAVE_CONFIG: 'desktop:save-config',
  TEST_CONNECTION: 'desktop:test-connection',
  GET_LOCAL_IPS: 'desktop:get-local-ips',
  GET_SERVER_STATUS: 'desktop:get-server-status',
  START_SERVER: 'desktop:start-server',
  STOP_SERVER: 'desktop:stop-server',
  GET_PRINTERS: 'desktop:get-printers',
  PRINT_RECEIPT: 'desktop:print-receipt',
  DISCOVER_SERVERS: 'desktop:discover-servers',
  CONFIGURE_FIREWALL: 'desktop:configure-firewall',
  GET_UPDATE_STATUS: 'desktop:get-update-status',
  CHECK_FOR_UPDATES: 'desktop:check-for-updates',
  INSTALL_UPDATE: 'desktop:install-update',
} as const;

export const DESKTOP_EVENTS = {
  UPDATE_STATUS_CHANGED: 'desktop:update-status-changed',
} as const;

export type DesktopChannels = typeof DESKTOP_CHANNELS;
export type DesktopChannel = (typeof DESKTOP_CHANNELS)[keyof typeof DESKTOP_CHANNELS];

/**
 * Strongly typed interface exposed to the Web Renderer via window.desktopApi.
 */
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
  discoverServers: () => Promise<DiscoveredServer[]>;
  configureFirewall: () => Promise<FirewallConfigResult>;
  getUpdateStatus?: () => Promise<DesktopUpdateStatus>;
  checkForUpdates?: () => Promise<DesktopUpdateStatus>;
  installUpdate?: () => Promise<{ success: boolean; error?: string }>;
  onUpdateStatusChange?: (callback: (status: DesktopUpdateStatus) => void) => () => void;
}

export type {
  DesktopConfig,
  DesktopUpdateSettings,
  DesktopUpdateStatus,
  ServerStatus,
  PrinterInfo,
  SilentPrintOptions,
  DiscoveredServer,
  FirewallConfigResult,
};
