import { useState, useEffect } from 'react';
import { Store } from '@tauri-apps/plugin-store';
import { ThemeMode } from '../theme';
import { AppSettings, AutoSaveMode, MarkdownViewMode } from '../components/Settings';

interface StoredSettings {
  theme: ThemeMode;
  showHiddenFiles: boolean;
  autoSave: AutoSaveMode;
  autoSaveDelay: number;
  markdownDefaultMode: MarkdownViewMode;
  enableRustLsp: boolean;
  enableGoLsp: boolean;
}

const DEFAULT_SETTINGS: StoredSettings = {
  theme: 'light',
  showHiddenFiles: true,
  autoSave: 'afterDelay',  // Default to auto save
  autoSaveDelay: 100,  // Fast auto save
  markdownDefaultMode: 'source',  // Default to source mode
  enableRustLsp: false,  // Default off - user must enable
  enableGoLsp: false,     // Default off - user must enable
};

let store: Store | null = null;

async function getStore() {
  if (!store) {
    store = await Store.load('settings.json');
  }
  return store;
}

export function usePersistedSettings() {
  const [theme, setTheme] = useState<ThemeMode>(DEFAULT_SETTINGS.theme);
  const [appSettings, setAppSettings] = useState<AppSettings>({
    showHiddenFiles: DEFAULT_SETTINGS.showHiddenFiles,
    autoSave: DEFAULT_SETTINGS.autoSave,
    autoSaveDelay: DEFAULT_SETTINGS.autoSaveDelay,
    markdownDefaultMode: DEFAULT_SETTINGS.markdownDefaultMode,
    enableRustLsp: DEFAULT_SETTINGS.enableRustLsp,
    enableGoLsp: DEFAULT_SETTINGS.enableGoLsp,
  });
  const [isLoaded, setIsLoaded] = useState(false);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const storeInstance = await getStore();
      
      const savedTheme = await storeInstance.get<ThemeMode>('theme');
      const savedShowHiddenFiles = await storeInstance.get<boolean>('showHiddenFiles');
      const savedAutoSave = await storeInstance.get<AutoSaveMode>('autoSave');
      const savedAutoSaveDelay = await storeInstance.get<number>('autoSaveDelay');
      const savedMarkdownDefaultMode = await storeInstance.get<MarkdownViewMode>('markdownDefaultMode');
      const savedEnableRustLsp = await storeInstance.get<boolean>('enableRustLsp');
      const savedEnableGoLsp = await storeInstance.get<boolean>('enableGoLsp');

      if (savedTheme) {
        setTheme(savedTheme);
      }
      
      setAppSettings(prev => ({
        ...prev,
        showHiddenFiles: savedShowHiddenFiles ?? prev.showHiddenFiles,
        autoSave: savedAutoSave ?? prev.autoSave,
        autoSaveDelay: savedAutoSaveDelay ?? prev.autoSaveDelay,
        markdownDefaultMode: savedMarkdownDefaultMode ?? prev.markdownDefaultMode,
        enableRustLsp: savedEnableRustLsp ?? prev.enableRustLsp,
        enableGoLsp: savedEnableGoLsp ?? prev.enableGoLsp,
      }));

      setIsLoaded(true);
    } catch (error) {
      console.error('Failed to load settings:', error);
      setIsLoaded(true);
    }
  };

  const saveTheme = async (newTheme: ThemeMode) => {
    setTheme(newTheme);
    try {
      const storeInstance = await getStore();
      await storeInstance.set('theme', newTheme);
      await storeInstance.save();
    } catch (error) {
      console.error('Failed to save theme:', error);
    }
  };

  const saveAppSettings = async (newSettings: AppSettings) => {
    setAppSettings(newSettings);
    try {
      const storeInstance = await getStore();
      await storeInstance.set('showHiddenFiles', newSettings.showHiddenFiles);
      await storeInstance.set('autoSave', newSettings.autoSave);
      await storeInstance.set('autoSaveDelay', newSettings.autoSaveDelay);
      await storeInstance.set('markdownDefaultMode', newSettings.markdownDefaultMode);
      await storeInstance.set('enableRustLsp', newSettings.enableRustLsp);
      await storeInstance.set('enableGoLsp', newSettings.enableGoLsp);
      await storeInstance.save();
    } catch (error) {
      console.error('Failed to save app settings:', error);
    }
  };

  return {
    theme,
    appSettings,
    isLoaded,
    setTheme: saveTheme,
    setAppSettings: saveAppSettings,
  };
}

