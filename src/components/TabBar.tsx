import React from 'react';
import CloseIcon from '@mui/icons-material/Close';
import SettingsIcon from '@mui/icons-material/Settings';
import CodeIcon from '@mui/icons-material/Code';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ViewSidebarIcon from '@mui/icons-material/ViewSidebar';
import { OpenFile } from '../types';
import { useTheme } from '../theme';
import './TabBar.css';

interface TabBarProps {
  openFiles: OpenFile[];
  activeFile: string | null;
  showSettings: boolean;
  autoSave: 'off' | 'afterDelay';
  autoSaveDelay: number;
  onTabClick: (path: string) => void;
  onTabClose: (path: string) => void;
  onCloseSettings: () => void;
  onMarkdownViewModeToggle?: (path: string) => void;
  onMarkdownViewModeChange?: (path: string, mode: 'rich' | 'source' | 'split') => void;
}

export const TabBar: React.FC<TabBarProps> = ({ 
  openFiles, 
  activeFile, 
  showSettings,
  autoSave,
  autoSaveDelay,
  onTabClick, 
  onTabClose,
  onCloseSettings,
  onMarkdownViewModeChange
}) => {
  const { mode } = useTheme();

  const handleCloseClick = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    onTabClose(path);
  };

  const handleCloseSettings = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCloseSettings();
  };

  const handleViewModeChange = (e: React.MouseEvent, newMode: 'rich' | 'source' | 'split') => {
    e.stopPropagation();
    if (activeFile && onMarkdownViewModeChange) {
      onMarkdownViewModeChange(activeFile, newMode);
    }
  };

  // Determine if we should show dirty indicator
  const shouldShowDirty = (file: OpenFile) => {
    if (!file.isDirty) return false;
    // Don't show dirty indicator if auto save is enabled with delay < 500ms
    if (autoSave === 'afterDelay' && autoSaveDelay < 500) return false;
    return true;
  };

  if (openFiles.length === 0 && !showSettings) {
    return null;
  }

  const activeFileData = openFiles.find(f => f.path === activeFile);
  const showMarkdownToggle = !showSettings && activeFileData?.type === 'markdown';

  return (
    <div className={`tab-bar-container ${mode}`}>
      <div className={`tab-bar ${mode}`}>
      {showSettings && (
        <div
          className={`tab ${mode} settings-tab active`}
        >
          <SettingsIcon fontSize="small" className="tab-icon" />
          <span className="tab-name">Settings</span>
          <button
            className={`tab-close ${mode}`}
            onClick={handleCloseSettings}
          >
            <CloseIcon fontSize="small" />
          </button>
        </div>
      )}
      {openFiles.map((file) => {
        const showDirty = shouldShowDirty(file);
        return (
          <div
            key={file.path}
            className={`tab ${mode} ${!showSettings && activeFile === file.path ? 'active' : ''} ${showDirty ? 'dirty' : ''}`}
            onClick={() => onTabClick(file.path)}
          >
            <span className="tab-name">
              {file.name}
            </span>
            {showDirty && <span className={`dirty-indicator ${mode}`}></span>}
            <button
              className={`tab-close ${mode}`}
              onClick={(e) => handleCloseClick(e, file.path)}
            >
              <CloseIcon fontSize="small" />
            </button>
          </div>
        );
      })}
      </div>
      
      {showMarkdownToggle && (
        <div className={`markdown-view-toggle ${mode}`}>
          <button
            className={`view-mode-button ${mode} ${activeFileData?.markdownViewMode === 'source' ? 'active' : ''}`}
            onClick={(e) => handleViewModeChange(e, 'source')}
            title="Source Code"
          >
            <CodeIcon fontSize="small" />
          </button>
          <button
            className={`view-mode-button ${mode} ${activeFileData?.markdownViewMode === 'split' ? 'active' : ''}`}
            onClick={(e) => handleViewModeChange(e, 'split')}
            title="Split Preview"
          >
            <ViewSidebarIcon fontSize="small" />
          </button>
          <button
            className={`view-mode-button ${mode} ${activeFileData?.markdownViewMode === 'rich' ? 'active' : ''}`}
            onClick={(e) => handleViewModeChange(e, 'rich')}
            title="Rich Editor"
          >
            <VisibilityIcon fontSize="small" />
          </button>
        </div>
      )}
    </div>
  );
};

