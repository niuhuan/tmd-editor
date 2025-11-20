import React from 'react';
import { useTheme } from '../theme';
import './Settings.css';

export type AutoSaveMode = 'off' | 'afterDelay';

export interface AppSettings {
  showHiddenFiles: boolean;
  autoSave: AutoSaveMode;
  autoSaveDelay: number;
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

  const handleAutoSaveChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onSettingsChange({
      ...settings,
      autoSave: e.target.value as AutoSaveMode,
    });
  };

  const handleAutoSaveDelayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const delay = parseInt(e.target.value);
    if (!isNaN(delay) && delay >= 100) {
      onSettingsChange({
        ...settings,
        autoSaveDelay: delay,
      });
    }
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
              <div className="setting-title">Auto Save</div>
              <div className="setting-description">
                Controls auto save of dirty files
              </div>
            </div>
            <div className="setting-control">
              <select 
                className={`setting-select ${mode}`}
                value={settings.autoSave}
                onChange={handleAutoSaveChange}
              >
                <option value="off">Off</option>
                <option value="afterDelay">After Delay</option>
              </select>
            </div>
          </div>

          {settings.autoSave === 'afterDelay' && (
            <div className="setting-item">
              <div className="setting-label">
                <div className="setting-title">Auto Save Delay</div>
                <div className="setting-description">
                  Delay in milliseconds after which a dirty file is saved automatically (default: 100ms)
                </div>
              </div>
              <div className="setting-control">
                <input
                  type="number"
                  className={`setting-input ${mode}`}
                  value={settings.autoSaveDelay}
                  onChange={handleAutoSaveDelayChange}
                  min="100"
                  step="100"
                />
              </div>
            </div>
          )}

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

