import React from 'react';
import { useTheme } from '../theme';
import './Settings.css';

export interface AppSettings {
  showHiddenFiles: boolean;
}

interface SettingsProps {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
}

export const Settings: React.FC<SettingsProps> = ({ settings, onSettingsChange }) => {
  const { mode } = useTheme();

  const handleToggleHiddenFiles = () => {
    onSettingsChange({
      ...settings,
      showHiddenFiles: !settings.showHiddenFiles,
    });
  };

  return (
    <div className={`settings ${mode}`}>
      <div className="settings-header">
        <h1>Settings</h1>
      </div>
      
      <div className="settings-content">
        <div className="settings-section">
          <h2>Files</h2>
          
          <div className="setting-item">
            <div className="setting-label">
              <div className="setting-title">Show Hidden Files</div>
              <div className="setting-description">
                Display files and folders that start with a dot (.)
              </div>
            </div>
            <div className="setting-control">
              <label className={`toggle-switch ${mode}`}>
                <input
                  type="checkbox"
                  checked={settings.showHiddenFiles}
                  onChange={handleToggleHiddenFiles}
                />
                <span className={`slider ${mode}`}></span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

