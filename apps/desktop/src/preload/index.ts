import { contextBridge, ipcRenderer } from 'electron';
import { DESKTOP_CHANNELS, DESKTOP_EVENTS, DesktopApi } from './desktop-api.types';

/**
 * Creates the DesktopApi object mapping each API method to its corresponding IPC invoke call.
 */
export function createDesktopApi(customIpcRenderer = ipcRenderer): DesktopApi {
  return {
    isDesktop: true,
    platform: process.platform,
    version: '1.0.0',
    getConfig: () => customIpcRenderer.invoke(DESKTOP_CHANNELS.GET_CONFIG),
    saveConfig: (config) => customIpcRenderer.invoke(DESKTOP_CHANNELS.SAVE_CONFIG, config),
    testConnection: (url) => customIpcRenderer.invoke(DESKTOP_CHANNELS.TEST_CONNECTION, url),
    getLocalIps: () => customIpcRenderer.invoke(DESKTOP_CHANNELS.GET_LOCAL_IPS),
    getServerStatus: () => customIpcRenderer.invoke(DESKTOP_CHANNELS.GET_SERVER_STATUS),
    startServer: () => customIpcRenderer.invoke(DESKTOP_CHANNELS.START_SERVER),
    stopServer: () => customIpcRenderer.invoke(DESKTOP_CHANNELS.STOP_SERVER),
    getPrinters: () => customIpcRenderer.invoke(DESKTOP_CHANNELS.GET_PRINTERS),
    printReceipt: (options) => customIpcRenderer.invoke(DESKTOP_CHANNELS.PRINT_RECEIPT, options),
    discoverServers: () => customIpcRenderer.invoke(DESKTOP_CHANNELS.DISCOVER_SERVERS),
    configureFirewall: () => customIpcRenderer.invoke(DESKTOP_CHANNELS.CONFIGURE_FIREWALL),
    getUpdateStatus: () => customIpcRenderer.invoke(DESKTOP_CHANNELS.GET_UPDATE_STATUS),
    checkForUpdates: () => customIpcRenderer.invoke(DESKTOP_CHANNELS.CHECK_FOR_UPDATES),
    installUpdate: () => customIpcRenderer.invoke(DESKTOP_CHANNELS.INSTALL_UPDATE),
    onUpdateStatusChange: (callback) => {
      const listener = (_event: any, status: any) => callback(status);
      customIpcRenderer.on(DESKTOP_EVENTS.UPDATE_STATUS_CHANGED, listener);
      return () => {
        if (typeof customIpcRenderer.removeListener === 'function') {
          customIpcRenderer.removeListener(DESKTOP_EVENTS.UPDATE_STATUS_CHANGED, listener);
        }
      };
    },
  };
}

export const api: DesktopApi = createDesktopApi();

// Expose safely into the renderer's main window world
if (typeof contextBridge !== 'undefined' && typeof contextBridge.exposeInMainWorld === 'function') {
  try {
    contextBridge.exposeInMainWorld('desktopApi', api);
  } catch (err) {
    console.error('Failed to expose desktopApi via contextBridge:', err);
  }
}
