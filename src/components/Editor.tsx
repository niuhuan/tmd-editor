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
  onCloseSettings
}) => {
  const { mode } = useTheme();

  const activeFileData = openFiles.find(f => f.path === activeFile);

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
      />
      {showSettings ? (
        <div className="editor-content">
          <Settings 
            settings={settings}
            onSettingsChange={onSettingsChange}
          />
        </div>
      ) : activeFileData ? (
        <div className="editor-content">
          <EditorPane 
            file={activeFileData}
            onContentChange={onContentChange}
          />
        </div>
      ) : (
        <div className={`editor-placeholder ${mode}`}>
          <h1>TMD Editor</h1>
          <p>Open a file from the explorer to start editing</p>
        </div>
      )}
    </div>
  );
};

