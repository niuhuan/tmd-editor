import { useState, useEffect, useRef } from "react";
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { ThemeContext, lightTheme, darkTheme } from "./theme";
import { ActivityBar } from "./components/ActivityBar";
import { Sidebar } from "./components/Sidebar";
import { Editor } from "./components/Editor";
import { StatusBar } from "./components/StatusBar";
import { AppSettings } from "./components/Settings";
import { OpenFile } from "./types";
import { usePersistedSettings } from "./hooks/useSettings";
import "./App.css";

function App() {
  const { theme: themeMode, appSettings: settings, isLoaded, setTheme, setAppSettings } = usePersistedSettings();
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [openFolderTrigger, setOpenFolderTrigger] = useState<number>(0);
  const [openFileTrigger, setOpenFileTrigger] = useState<number>(0);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const autoSaveTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const toggleTheme = () => {
    setTheme(themeMode === 'light' ? 'dark' : 'light');
  };

  const getFileType = (filename: string): 'txt' | 'markdown' | 'unsupported' => {
    const ext = filename.toLowerCase().split('.').pop();
    if (ext === 'txt') return 'txt';
    if (ext === 'md' || ext === 'markdown') return 'markdown';
    return 'unsupported';
  };

  const handleFileClick = async (path: string) => {
    // Check if file is already open
    const existingFile = openFiles.find(f => f.path === path);
    
    if (existingFile) {
      // If it's an unsupported file, close it first
      if (existingFile.isUnsupported) {
        setOpenFiles(prev => prev.filter(f => f.path !== path));
      } else {
        // Just activate it
        setActiveFile(path);
        return;
      }
    }

    // Read file content
    try {
      const content = await invoke<string>('read_file_content', { path });
      const filename = path.split(/[/\\]/).pop() || 'Unknown';
      const fileType = getFileType(filename);
      
      const newFile: OpenFile = {
        path,
        name: filename,
        content,
        originalContent: content,
        type: fileType,
        isUnsupported: fileType === 'unsupported',
        isDirty: false,
      };

      // If opening an unsupported file, close any existing unsupported file
      if (newFile.isUnsupported) {
        setOpenFiles(prev => [...prev.filter(f => !f.isUnsupported), newFile]);
      } else {
        setOpenFiles(prev => [...prev, newFile]);
      }
      
      setActiveFile(path);
    } catch (error) {
      console.error('Failed to read file:', error);
      alert(`Failed to open file: ${error}`);
    }
  };

  const handleTabClick = (path: string) => {
    setActiveFile(path);
  };

  const handleTabClose = (path: string) => {
    setOpenFiles(prev => {
      const newFiles = prev.filter(f => f.path !== path);
      
      // If closing active file, switch to another tab
      if (path === activeFile) {
        if (newFiles.length > 0) {
          const closedIndex = prev.findIndex(f => f.path === path);
          const newActiveIndex = closedIndex > 0 ? closedIndex - 1 : 0;
          setActiveFile(newFiles[newActiveIndex]?.path || null);
        } else {
          setActiveFile(null);
        }
      }
      
      return newFiles;
    });
  };

  const handleContentChange = (path: string, content: string) => {
    setOpenFiles(prev => prev.map(f => {
      if (f.path === path) {
        const isDirty = content !== f.originalContent;
        
        // Clear existing auto save timer
        const existingTimer = autoSaveTimers.current.get(path);
        if (existingTimer) {
          clearTimeout(existingTimer);
        }
        
        // Set new auto save timer if enabled
        if (settings.autoSave === 'afterDelay' && isDirty) {
          const timer = setTimeout(() => {
            saveFile(path, content);
          }, settings.autoSaveDelay);
          autoSaveTimers.current.set(path, timer);
        }
        
        return { ...f, content, isDirty };
      }
      return f;
    }));
  };

  const saveFile = async (path: string, content?: string) => {
    const file = openFiles.find(f => f.path === path);
    if (!file) return;

    const contentToSave = content ?? file.content;

    try {
      await invoke('save_file', { path, content: contentToSave });
      
      // Update file state: mark as not dirty, update original content
      setOpenFiles(prev => prev.map(f => 
        f.path === path 
          ? { ...f, content: contentToSave, originalContent: contentToSave, isDirty: false } 
          : f
      ));
      
      // Clear auto save timer
      const timer = autoSaveTimers.current.get(path);
      if (timer) {
        clearTimeout(timer);
        autoSaveTimers.current.delete(path);
      }
      
      console.log(`File saved: ${path}`);
    } catch (error) {
      console.error('Failed to save file:', error);
      alert(`Failed to save file: ${error}`);
    }
  };

  const saveActiveFile = () => {
    if (activeFile) {
      const file = openFiles.find(f => f.path === activeFile);
      if (file && file.isDirty) {
        saveFile(activeFile);
      }
    }
  };

  const handleOpenSettings = () => {
    setShowSettings(true);
    setActiveFile(null);
  };

  const handleCloseSettings = () => {
    setShowSettings(false);
  };

  const handleSettingsChange = (newSettings: AppSettings) => {
    setAppSettings(newSettings);
  };

  // Listen for menu events
  useEffect(() => {
    const unlistenOpenFolder = listen('menu-open-folder', () => {
      setOpenFolderTrigger(prev => prev + 1);
    });

    const unlistenOpenFile = listen('menu-open-file', () => {
      setOpenFileTrigger(prev => prev + 1);
    });

    const unlistenSettings = listen('menu-settings', () => {
      handleOpenSettings();
    });

    const unlistenSave = listen('menu-save', () => {
      saveActiveFile();
    });

    const unlistenSaveAll = listen('menu-save-all', () => {
      saveAllFiles();
    });

    return () => {
      unlistenOpenFolder.then(fn => fn());
      unlistenOpenFile.then(fn => fn());
      unlistenSettings.then(fn => fn());
      unlistenSave.then(fn => fn());
      unlistenSaveAll.then(fn => fn());
    };
  }, [openFiles, activeFile]);


  // Cleanup auto save timers on unmount
  useEffect(() => {
    return () => {
      autoSaveTimers.current.forEach(timer => clearTimeout(timer));
      autoSaveTimers.current.clear();
    };
  }, []);

  const theme = themeMode === 'light' ? lightTheme : darkTheme;

  // Don't render until settings are loaded
  if (!isLoaded) {
    return null;
  }

  return (
    <ThemeContext.Provider value={{ mode: themeMode, toggleTheme }}>
      <div 
        className={`app ${themeMode}`}
        style={{ 
          backgroundColor: theme.colors.background,
          color: theme.colors.text 
        }}
      >
        <div className="app-container">
          <ActivityBar onSettingsClick={handleOpenSettings} />
          <div className="app-sidebar">
            <Sidebar 
              onFileClick={handleFileClick}
              openFolderTrigger={openFolderTrigger}
              openFileTrigger={openFileTrigger}
              showHiddenFiles={settings.showHiddenFiles}
              activeFilePath={activeFile}
            />
          </div>
          <div className="app-main">
            <Editor 
              openFiles={openFiles}
              activeFile={activeFile}
              showSettings={showSettings}
              settings={settings}
              onTabClick={handleTabClick}
              onTabClose={handleTabClose}
              onContentChange={handleContentChange}
              onSettingsChange={handleSettingsChange}
              onCloseSettings={handleCloseSettings}
            />
          </div>
        </div>
        <StatusBar />
      </div>
    </ThemeContext.Provider>
  );
}

export default App;
