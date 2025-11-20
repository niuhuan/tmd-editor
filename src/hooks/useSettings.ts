import { useState, useEffect } from 'react';
import { Store } from '@tauri-apps/plugin-store';
import { ThemeMode } from '../theme';
import { AppSettings } from '../components/Settings';

interface StoredSettings {
  theme: ThemeMode;
  showHiddenFiles: boolean;
}

const DEFAULT_SETTINGS: StoredSettings = {
  theme: 'light',
  showHiddenFiles: true,
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

      if (savedTheme) {
        setTheme(savedTheme);
      }
      
      if (savedShowHiddenFiles !== null && savedShowHiddenFiles !== undefined) {
        setAppSettings(prev => ({
          ...prev,
          showHiddenFiles: savedShowHiddenFiles,
        }));
      }

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

