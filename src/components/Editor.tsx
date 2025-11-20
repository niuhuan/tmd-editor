import React from 'react';
import { TabBar } from './TabBar';
import { EditorPane } from './EditorPane';
import { Settings, AppSettings } from './Settings';
import { OpenFile } from '../types';
import { useTheme } from '../theme';
import './Editor.css';

interface EditorProps {
  openFiles: OpenFile[];
  activeFile: string | null;
  showSettings: boolean;
  settings: AppSettings;
  onTabClick: (path: string) => void;
  onTabClose: (path: string) => void;
  onContentChange: (path: string, content: string) => void;
  onSettingsChange: (settings: AppSettings) => void;
  onCloseSettings: () => void;
  onMarkdownViewModeToggle: (path: string) => void;
  onMarkdownViewModeChange: (path: string, mode: 'rich' | 'source' | 'split') => void;
}

export const Editor: React.FC<EditorProps> = ({ 
  openFiles, 
  activeFile, 
  showSettings,
  settings,
  onTabClick, 
  onTabClose,
  onContentChange,
  onSettingsChange,
  onCloseSettings,
  onMarkdownViewModeToggle,
  onMarkdownViewModeChange
}) => {
  const { mode } = useTheme();

  const hasContent = openFiles.length > 0 || showSettings;

  return (
    <div className={`editor ${mode}`}>
      <TabBar 
        openFiles={openFiles}
        activeFile={activeFile}
        showSettings={showSettings}
        autoSave={settings.autoSave}
        autoSaveDelay={settings.autoSaveDelay}
        onTabClick={onTabClick}
        onTabClose={onTabClose}
        onCloseSettings={onCloseSettings}
        onMarkdownViewModeToggle={onMarkdownViewModeToggle}
        onMarkdownViewModeChange={onMarkdownViewModeChange}
      />
      
      {/* Settings - only render when visible */}
      {showSettings && (
        <div className="editor-content">
          <Settings 
            settings={settings}
            onSettingsChange={onSettingsChange}
          />
        </div>
      )}
      
      {/* Render all open files, hide inactive ones with CSS */}
      {openFiles.map(file => (
        <div 
          key={file.path}
          className="editor-content"
          style={{ 
            display: !showSettings && activeFile === file.path ? 'flex' : 'none',
            flexDirection: 'column',
            height: '100%'
          }}
        >
          <EditorPane 
            file={file}
            onContentChange={onContentChange}
          />
        </div>
      ))}
      
      {/* Placeholder - show when no files are open and settings is closed */}
      {!hasContent && (
        <div className={`editor-placeholder ${mode}`}>
          <h1>TMD Editor</h1>
          <p>Open a file from the explorer to start editing</p>
        </div>
      )}
    </div>
  );
};

