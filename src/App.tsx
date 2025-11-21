import { useState, useEffect, useRef } from "react";
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { ThemeContext, lightTheme, darkTheme } from "./theme";
import { ActivityBar } from "./components/ActivityBar";
import { Sidebar } from "./components/Sidebar";
import { Editor } from "./components/Editor";
import { StatusBar } from "./components/StatusBar";
import { TerminalPanel } from "./components/TerminalPanel";
import { LspManager } from "./components/LspManager";
import { AppSettings } from "./components/Settings";
import { OpenFile } from "./types";
import { usePersistedSettings } from "./hooks/useSettings";
import { LspProvider } from "./contexts/LspContext";
import "./App.css";

function App() {
  const { theme: themeMode, appSettings: settings, isLoaded, setTheme, setAppSettings } = usePersistedSettings();
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [openFolderTrigger, setOpenFolderTrigger] = useState<number>(0);
  const [openFileTrigger, setOpenFileTrigger] = useState<number>(0);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [sidebarWidth, setSidebarWidth] = useState<number>(250);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const [showTerminal, setShowTerminal] = useState<boolean>(false);
  const [terminalInitialized, setTerminalInitialized] = useState<boolean>(false);
  const [currentWorkspace, setCurrentWorkspace] = useState<string | null>(null);
  const [activeLsps, setActiveLsps] = useState<string[]>([]); // e.g., ["rust", "go"]
  const autoSaveTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const toggleTheme = () => {
    setTheme(themeMode === 'light' ? 'dark' : 'light');
  };

  const handleMouseDown = () => {
    setIsResizing(true);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing) return;
    
    // Calculate new width (subtract ActivityBar width of 48px)
    const newWidth = e.clientX - 48;
    
    // Set min and max width constraints
    if (newWidth >= 180 && newWidth <= 600) {
      setSidebarWidth(newWidth);
    }
  };

  const handleMouseUp = () => {
    setIsResizing(false);
  };

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove as any);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.removeEventListener('mousemove', handleMouseMove as any);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove as any);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  const getFileType = (filename: string): OpenFile['type'] => {
    const ext = filename.toLowerCase().split('.').pop() || '';
    
    // Image files
    if (['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg', 'ico'].includes(ext)) {
      return 'image';
    }
    
    // JavaScript/TypeScript
    if (ext === 'js' || ext === 'mjs' || ext === 'cjs') return 'javascript';
    if (ext === 'ts' || ext === 'mts' || ext === 'cts') return 'typescript';
    if (ext === 'jsx') return 'jsx';
    if (ext === 'tsx') return 'tsx';
    
    // Python
    if (ext === 'py' || ext === 'pyw') return 'python';
    
    // Rust
    if (ext === 'rs') return 'rust';
    
    // Go
    if (ext === 'go') return 'go';
    
    // Java
    if (ext === 'java') return 'java';
    
    // C/C++/C#
    if (ext === 'cpp' || ext === 'cc' || ext === 'cxx' || ext === 'hpp' || ext === 'h++') return 'cpp';
    if (ext === 'c' || ext === 'h') return 'c';
    if (ext === 'cs') return 'csharp';
    
    // PHP
    if (ext === 'php' || ext === 'phtml') return 'php';
    
    // HTML/CSS/SCSS/SASS/LESS
    if (ext === 'html' || ext === 'htm') return 'html';
    if (ext === 'css') return 'css';
    if (ext === 'scss') return 'scss';
    if (ext === 'sass') return 'sass';
    if (ext === 'less') return 'less';
    
    // JSON/XML/YAML/TOML
    if (ext === 'json') return 'json';
    if (ext === 'xml' || ext === 'xsl' || ext === 'xsd') return 'xml';
    if (ext === 'yaml' || ext === 'yml') return 'yaml';
    if (ext === 'toml') return 'toml';
    
    // Markdown
    if (ext === 'md' || ext === 'markdown') return 'markdown';
    
    // SQL
    if (ext === 'sql') return 'sql';
    
    // Plain text
    if (ext === 'txt' || ext === 'log' || ext === '') return 'txt';
    
    // Default to plain text for unknown extensions
    return 'plaintext';
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

    const filename = path.split(/[/\\]/).pop() || 'Unknown';
    const fileType = getFileType(filename);

    // Handle different file types
    try {
      let content = '';
      
      if (fileType === 'image') {
        // Read image as base64
        content = await invoke<string>('read_image_file', { path });
      } else if (fileType !== 'unsupported') {
        // Read all text-based files
        try {
          content = await invoke<string>('read_file_content', { path });
        } catch (error) {
          // If text reading fails, treat as unsupported
          console.error('Failed to read as text:', error);
          const newFile: OpenFile = {
            path,
            name: filename,
            content: '',
            originalContent: '',
            type: 'unsupported',
            isUnsupported: true,
            isDirty: false,
          };
          setOpenFiles(prev => [...prev.filter(f => !f.isUnsupported), newFile]);
          setActiveFile(path);
          return;
        }
      }
      
      const newFile: OpenFile = {
        path,
        name: filename,
        content,
        originalContent: content,
        type: fileType,
        isUnsupported: fileType === 'unsupported',
        isDirty: false,
        markdownViewMode: fileType === 'markdown' ? settings.markdownDefaultMode : undefined,
      };

      // If opening an unsupported file or image, close any existing unsupported file
      if (newFile.isUnsupported || fileType === 'image') {
        setOpenFiles(prev => [...prev.filter(f => !f.isUnsupported && f.type !== 'image'), newFile]);
      } else {
        setOpenFiles(prev => [...prev, newFile]);
      }
      
      setActiveFile(path);
    } catch (error) {
      console.error('Failed to read file:', error);
      // Don't show alert, just display unsupported message
      const newFile: OpenFile = {
        path,
        name: filename,
        content: '',
        originalContent: '',
        type: 'unsupported',
        isUnsupported: true,
        isDirty: false,
      };
      setOpenFiles(prev => [...prev.filter(f => !f.isUnsupported), newFile]);
      setActiveFile(path);
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
    setOpenFiles(prev => {
      const targetFile = prev.find(f => f.path === path);
      if (!targetFile) return prev;
      
      const isDirty = content !== targetFile.originalContent;
      
      // If content and isDirty haven't changed, return the same array
      if (targetFile.content === content && targetFile.isDirty === isDirty) {
        return prev;
      }
      
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
      
      // Only create new array if actually changed
      return prev.map(f => 
        f.path === path ? { ...f, content, isDirty } : f
      );
    });
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

  const saveAllFiles = async () => {
    const dirtyFiles = openFiles.filter(f => f.isDirty && !f.isUnsupported && f.type !== 'image');
    for (const file of dirtyFiles) {
      await saveFile(file.path);
    }
  };

  const previousActiveFileRef = useRef<string | null>(null);

  const handleOpenSettings = () => {
    // Save current active file before opening settings
    previousActiveFileRef.current = activeFile;
    setShowSettings(true);
    setActiveFile(null);
  };

  const handleCloseSettings = () => {
    setShowSettings(false);
    // Restore previous active file
    if (previousActiveFileRef.current && openFiles.find(f => f.path === previousActiveFileRef.current)) {
      setActiveFile(previousActiveFileRef.current);
    } else if (openFiles.length > 0) {
      // If previous file was closed, activate the first file
      setActiveFile(openFiles[0].path);
    }
  };

  const handleToggleTerminal = () => {
    setShowTerminal(prev => {
      const newValue = !prev;
      // Initialize terminal on first open
      if (newValue && !terminalInitialized) {
        setTerminalInitialized(true);
      }
      return newValue;
    });
  };

  const handleWorkspaceChange = (path: string | null) => {
    setCurrentWorkspace(path);
  };

  const handleLspStatusChange = (lsps: string[]) => {
    setActiveLsps(lsps);
  };

  const handleMarkdownViewModeToggle = (path: string) => {
    setOpenFiles(prev => {
      const targetFile = prev.find(f => f.path === path && f.type === 'markdown');
      if (!targetFile) return prev;
      
      // Cycle through modes: source -> split -> rich -> source
      const currentMode = targetFile.markdownViewMode || 'source';
      let newMode: 'rich' | 'source' | 'split';
      
      if (currentMode === 'source') {
        newMode = 'split';
      } else if (currentMode === 'split') {
        newMode = 'rich';
      } else {
        newMode = 'source';
      }
      
      // Only create new array if mode actually changed
      return prev.map(f => 
        f.path === path && f.type === 'markdown' 
          ? { ...f, markdownViewMode: newMode }
          : f
      );
    });
  };

  const handleMarkdownViewModeChange = (path: string, mode: 'rich' | 'source' | 'split') => {
    setOpenFiles(prev => {
      const targetFile = prev.find(f => f.path === path && f.type === 'markdown');
      if (!targetFile || targetFile.markdownViewMode === mode) return prev;
      
      return prev.map(f => 
        f.path === path && f.type === 'markdown'
          ? { ...f, markdownViewMode: mode }
          : f
      );
    });
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

    const unlistenToggleTerminal = listen('menu-toggle-terminal', () => {
      handleToggleTerminal();
    });

    return () => {
      unlistenOpenFolder.then(fn => fn());
      unlistenOpenFile.then(fn => fn());
      unlistenSettings.then(fn => fn());
      unlistenSave.then(fn => fn());
      unlistenSaveAll.then(fn => fn());
      unlistenToggleTerminal.then(fn => fn());
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
    <LspProvider>
      <ThemeContext.Provider value={{ mode: themeMode, toggleTheme }}>
        <LspManager 
          workspacePath={currentWorkspace}
          onLspStatusChange={handleLspStatusChange}
          enableRustLsp={settings.enableRustLsp}
          enableGoLsp={settings.enableGoLsp}
        />
        <div 
          className={`app ${themeMode}`}
          style={{ 
            backgroundColor: theme.colors.background,
            color: theme.colors.text 
          }}
        >
        <div className="app-container">
          <ActivityBar onSettingsClick={handleOpenSettings} />
          <div className="app-sidebar" style={{ width: `${sidebarWidth}px` }}>
            <Sidebar 
              onFileClick={handleFileClick}
              openFolderTrigger={openFolderTrigger}
              openFileTrigger={openFileTrigger}
              showHiddenFiles={settings.showHiddenFiles}
              activeFilePath={activeFile}
              onWorkspaceChange={handleWorkspaceChange}
            />
          </div>
          <div 
            className={`sidebar-resizer ${themeMode} ${isResizing ? 'resizing' : ''}`}
            onMouseDown={handleMouseDown}
          />
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
              onMarkdownViewModeToggle={handleMarkdownViewModeToggle}
              onMarkdownViewModeChange={handleMarkdownViewModeChange}
            />
            {terminalInitialized && (
              <div style={{ display: showTerminal ? 'flex' : 'none', flexDirection: 'column' }}>
                <TerminalPanel workingDirectory={currentWorkspace} />
              </div>
            )}
          </div>
        </div>
        <StatusBar 
          activeFile={openFiles.find(f => f.path === activeFile) || null}
          showTerminal={showTerminal}
          onToggleTerminal={handleToggleTerminal}
          activeLsps={activeLsps}
        />
        </div>
      </ThemeContext.Provider>
    </LspProvider>
  );
}

export default App;

