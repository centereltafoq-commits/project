import type { DesktopConfig } from '../main/store-manager';
import type { ServerStatus } from '../main/server-manager';
import type { PrinterInfo, SilentPrintOptions } from '../main/printer-manager';
import type { DiscoveredServer } from '../main/lan-discovery';
import type { FirewallConfigResult } from '../main/firewall-utils';

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
}

export type {
  DesktopConfig,
  ServerStatus,
  PrinterInfo,
  SilentPrintOptions,
  DiscoveredServer,
  FirewallConfigResult,
};
