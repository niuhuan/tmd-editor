import React from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTheme } from '../theme';
import './Settings.css';

export type AutoSaveMode = 'off' | 'afterDelay';
export type MarkdownViewMode = 'rich' | 'source' | 'split';

export interface AppSettings {
  showHiddenFiles: boolean;
  autoSave: AutoSaveMode;
  autoSaveDelay: number;
  markdownDefaultMode: MarkdownViewMode;
  enableRustLsp: boolean;
  enableGoLsp: boolean;
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

  const handleMarkdownDefaultModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onSettingsChange({
      ...settings,
      markdownDefaultMode: e.target.value as MarkdownViewMode,
    });
  };

  const handleToggleRustLsp = async () => {
    const newValue = !settings.enableRustLsp;
    
    // If enabling, check availability first
    if (newValue) {
      try {
        const isAvailable = await invoke<boolean>('check_lsp_available', { language: 'rust' });
        
        if (!isAvailable) {
          const installMsg = `rust-analyzer is not installed or not in PATH.

Installation options:
1. Via rustup (recommended):
   rustup component add rust-analyzer

2. Via cargo:
   cargo install rust-analyzer

3. Download binary from:
   https://github.com/rust-lang/rust-analyzer/releases

After installation, restart the editor.`;
          
          alert(installMsg);
          return; // Don't enable the setting
        }
      } catch (e) {
        console.error('[Settings] Failed to check Rust LSP:', e);
        alert('Failed to check rust-analyzer availability. Please try again.');
        return;
      }
    }
    
    onSettingsChange({
      ...settings,
      enableRustLsp: newValue,
    });
  };

  const handleToggleGoLsp = async () => {
    const newValue = !settings.enableGoLsp;
    
    // If enabling, check availability first
    if (newValue) {
      try {
        const isAvailable = await invoke<boolean>('check_lsp_available', { language: 'go' });
        
        if (!isAvailable) {
          const installMsg = `gopls is not installed or not in PATH.

Installation:
go install golang.org/x/tools/gopls@latest

Make sure $GOPATH/bin is in your PATH.

After installation, restart the editor.`;
          
          alert(installMsg);
          return; // Don't enable the setting
        }
      } catch (e) {
        console.error('[Settings] Failed to check Go LSP:', e);
        alert('Failed to check gopls availability. Please try again.');
        return;
      }
    }
    
    onSettingsChange({
      ...settings,
      enableGoLsp: newValue,
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

        <div className="settings-section">
          <h2>Editor</h2>
          
          <div className="setting-item">
            <div className="setting-label">
              <div className="setting-title">Markdown Default Mode</div>
              <div className="setting-description">
                Default view mode when opening Markdown files
              </div>
            </div>
            <div className="setting-control">
              <select 
                className={`setting-select ${mode}`}
                value={settings.markdownDefaultMode}
                onChange={handleMarkdownDefaultModeChange}
              >
                <option value="source">Source Code</option>
                <option value="split">Split Preview</option>
                <option value="rich">Rich Editor</option>
              </select>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <h2>Language Server Protocol (LSP)</h2>
          
          <div className="setting-item">
            <div className="setting-label">
              <div className="setting-title">Rust LSP (rust-analyzer)</div>
              <div className="setting-description">
                Enable code completion and diagnostics for Rust projects. Requires rust-analyzer to be installed.
                <br />
                <span className="setting-hint">
                  Install: <code>rustup component add rust-analyzer</code>
                </span>
              </div>
            </div>
            <div className="setting-control">
              <label className={`toggle-switch ${mode}`}>
                <input
                  type="checkbox"
                  checked={settings.enableRustLsp}
                  onChange={handleToggleRustLsp}
                />
                <span className={`slider ${mode}`}></span>
              </label>
            </div>
          </div>

          <div className="setting-item">
            <div className="setting-label">
              <div className="setting-title">Go LSP (gopls)</div>
              <div className="setting-description">
                Enable code completion and diagnostics for Go projects. Requires gopls to be installed.
                <br />
                <span className="setting-hint">
                  Install: <code>go install golang.org/x/tools/gopls@latest</code>
                </span>
              </div>
            </div>
            <div className="setting-control">
              <label className={`toggle-switch ${mode}`}>
                <input
                  type="checkbox"
                  checked={settings.enableGoLsp}
                  onChange={handleToggleGoLsp}
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

