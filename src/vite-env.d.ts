/// <reference types="vite/client" />

interface Window {
  electronAPI?: {
    platform: string;
    isElectron: boolean;
    getAppVersion: () => Promise<string>;
    minimizeWindow: () => void;
    maximizeWindow: () => void;
    closeWindow: () => void;
  };
}
