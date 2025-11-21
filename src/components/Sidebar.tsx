import React, { useState, useEffect } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteIcon from '@mui/icons-material/Delete';
import FolderIcon from '@mui/icons-material/Folder';
import DescriptionIcon from '@mui/icons-material/Description';
import { FileTree } from './FileTree';
import { FileEntry } from '../types';
import { useTheme } from '../theme';
import { useRecentFiles } from '../hooks/useRecentFiles';
import './Sidebar.css';

interface SidebarProps {
  onFileClick?: (path: string) => void;
  openFolderTrigger?: number;
  openFileTrigger?: number;
  showHiddenFiles?: boolean;
  activeFilePath?: string | null;
  onWorkspaceChange?: (path: string | null) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onFileClick, openFolderTrigger, openFileTrigger, showHiddenFiles = true, activeFilePath, onWorkspaceChange }) => {
  const [rootPath, setRootPath] = useState<string | null>(null);
  const [folderName, setFolderName] = useState<string>('');
  const [selectedEntry, setSelectedEntry] = useState<FileEntry | null>(null);
  const [newItemName, setNewItemName] = useState<string>('');
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const { mode } = useTheme();
  const { recentItems, isLoaded: recentLoaded, addRecentItem, clearRecentItems } = useRecentFiles();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedEntry(null);
        setIsCreatingFile(false);
        setIsCreatingFolder(false);
        setNewItemName('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (openFolderTrigger !== undefined && openFolderTrigger > 0) {
      handleOpenFolder();
    }
  }, [openFolderTrigger, addRecentItem]);

  useEffect(() => {
    if (openFileTrigger !== undefined && openFileTrigger > 0) {
      handleOpenFile();
    }
  }, [openFileTrigger, addRecentItem]);

  const handleOpenFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      });

      if (selected && typeof selected === 'string') {
        setRootPath(selected);
        // Extract folder name from path
        const parts = selected.split(/[/\\]/);
        const name = parts[parts.length - 1] || 'Unknown';
        setFolderName(name);
        // Select the root folder
        setSelectedEntry({
          name,
          path: selected,
          is_directory: true,
          is_file: false,
        });
        // Add to recent items
        addRecentItem(selected, true);
        // Notify parent component
        if (onWorkspaceChange) {
          onWorkspaceChange(selected);
        }
      }
    } catch (error) {
      console.error('Failed to open folder:', error);
    }
  };

  const handleOpenFile = async () => {
    try {
      const selected = await open({
        directory: false,
        multiple: false,
      });

      if (selected && typeof selected === 'string') {
        // Add to recent items
        addRecentItem(selected, false);
        // Open file
        if (onFileClick) {
          onFileClick(selected);
        }
      }
    } catch (error) {
      console.error('Failed to open file:', error);
    }
  };

  const handleCreateFile = () => {
    if (!rootPath) {
      alert('Please open a folder first');
      return;
    }
    setIsCreatingFile(true);
  };

  const handleCreateFolder = () => {
    if (!rootPath) {
      alert('Please open a folder first');
      return;
    }
    setIsCreatingFolder(true);
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleRecentItemClick = async (item: { path: string; isDirectory: boolean }) => {
    try {
      // Check if path exists
      const exists = await invoke<boolean>('path_exists', { path: item.path });
      
      if (!exists) {
        alert(`File or folder does not exist:\n${item.path}`);
        return;
      }

      if (item.isDirectory) {
        // Open folder
        setRootPath(item.path);
        const parts = item.path.split(/[/\\]/);
        const name = parts[parts.length - 1] || 'Unknown';
        setFolderName(name);
        setSelectedEntry({
          name,
          path: item.path,
          is_directory: true,
          is_file: false,
        });
        // Add to recent items (update timestamp)
        addRecentItem(item.path, true);
        if (onWorkspaceChange) {
          onWorkspaceChange(item.path);
        }
      } else {
        // Open file
        addRecentItem(item.path, false);
        if (onFileClick) {
          onFileClick(item.path);
        }
      }
    } catch (error) {
      console.error('Failed to open recent item:', error);
      alert(`Failed to open:\n${item.path}\n\nError: ${error}`);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !rootPath) return;

    // Determine target directory
    let targetDir = rootPath;
    
    // If there's a selected entry, use it as the target
    if (selectedEntry) {
      // If selected entry is a directory, use it
      if (selectedEntry.is_directory) {
        targetDir = selectedEntry.path;
      } else {
        // If selected entry is a file, use its parent directory
        const parts = selectedEntry.path.split(/[/\\]/);
        parts.pop();
        targetDir = parts.join('/');
      }
    }
    // If no selected entry, use rootPath (already set above)

    const newPath = `${targetDir}/${newItemName}`;

    try {
      if (isCreatingFile) {
        await invoke('create_file', { path: newPath });
      } else if (isCreatingFolder) {
        await invoke('create_directory', { path: newPath });
      }
      
      // Reset state
      setNewItemName('');
      setIsCreatingFile(false);
      setIsCreatingFolder(false);
      
      // Refresh the tree
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error('Failed to create item:', error);
      alert(`Failed to create: ${error}`);
    }
  };

  if (!rootPath) {
    return (
      <div className={`sidebar ${mode}`}>
        <div className={`sidebar-header ${mode}`}>
          <div className="sidebar-title">EXPLORER</div>
        </div>
        <div className="sidebar-content">
          <div className={`sidebar-empty ${mode}`}>
            <p>You have not yet opened a folder.</p>
            <button 
              className={`open-folder-button ${mode}`}
              onClick={handleOpenFolder}
            >
              Open Folder
            </button>
            <button 
              className={`open-file-button ${mode}`}
              onClick={handleOpenFile}
            >
              Open File
            </button>
            
            {/* Recent Files Section */}
            {recentLoaded && recentItems.length > 0 && (
              <div className={`recent-files-section ${mode}`}>
                <div className="recent-files-header">
                  <span className="recent-files-title">Recent</span>
                  <button
                    className={`clear-recent-btn ${mode}`}
                    onClick={clearRecentItems}
                    title="Clear recent files"
                  >
                    <DeleteIcon fontSize="small" />
                  </button>
                </div>
                <div className="recent-files-list">
                  {recentItems.map((item) => (
                    <div
                      key={`${item.path}-${item.timestamp}`}
                      className={`recent-file-item ${mode}`}
                      onClick={() => handleRecentItemClick(item)}
                      title={item.path}
                    >
                      {item.isDirectory ? (
                        <FolderIcon fontSize="small" className="recent-file-icon" />
                      ) : (
                        <DescriptionIcon fontSize="small" className="recent-file-icon" />
                      )}
                      <span className="recent-file-name">{item.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`sidebar ${mode}`}
      onMouseEnter={() => setIsSidebarHovered(true)}
      onMouseLeave={() => setIsSidebarHovered(false)}
    >
      <div className={`sidebar-header ${mode}`}>
        <div className="sidebar-title" title={rootPath}>
          {folderName || 'EXPLORER'}
        </div>
        <div className={`sidebar-actions ${isSidebarHovered ? 'visible' : ''}`}>
          <button
            className={`action-btn ${mode}`}
            onClick={handleRefresh}
            title="Refresh Explorer"
            disabled={!rootPath}
          >
            <RefreshIcon fontSize="small" />
          </button>
          <button
            className={`action-btn ${mode}`}
            onClick={handleCreateFile}
            title="New File"
            disabled={!rootPath}
          >
            <NoteAddIcon fontSize="small" />
          </button>
          <button
            className={`action-btn ${mode}`}
            onClick={handleCreateFolder}
            title="New Folder"
            disabled={!rootPath}
          >
            <CreateNewFolderIcon fontSize="small" />
          </button>
        </div>
      </div>
      <div className="sidebar-content">
        {(isCreatingFile || isCreatingFolder) && (
          <div className={`create-item-form ${mode}`}>
            <form onSubmit={handleCreateSubmit}>
              <input
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder={isCreatingFile ? 'File name' : 'Folder name'}
                className={`create-item-input ${mode}`}
                autoFocus
              />
              <div className="create-item-actions">
                <button type="submit" className={`create-btn ${mode}`}>
                  Create
                </button>
                <button 
                  type="button" 
                  className={`cancel-btn ${mode}`}
                  onClick={() => {
                    setIsCreatingFile(false);
                    setIsCreatingFolder(false);
                    setNewItemName('');
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
        <FileTree 
          rootPath={rootPath} 
          onFileClick={onFileClick}
          activeFilePath={activeFilePath}
          refreshKey={refreshKey}
          showHiddenFiles={showHiddenFiles}
          onRefreshNeeded={() => setRefreshKey(prev => prev + 1)}
        />
      </div>
    </div>
  );
};
