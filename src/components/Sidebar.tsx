import React, { useState, useEffect } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import { FileTree } from './FileTree';
import { FileEntry } from '../types';
import { useTheme } from '../theme';
import './Sidebar.css';

interface SidebarProps {
  onFileClick?: (path: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onFileClick }) => {
  const [rootPath, setRootPath] = useState<string | null>(null);
  const [folderName, setFolderName] = useState<string>('');
  const [selectedEntry, setSelectedEntry] = useState<FileEntry | null>(null);
  const [newItemName, setNewItemName] = useState<string>('');
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const { mode } = useTheme();

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
      }
    } catch (error) {
      console.error('Failed to open folder:', error);
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
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`sidebar ${mode}`}>
      <div className={`sidebar-header ${mode}`}>
        <div className="sidebar-title" title={rootPath}>
          {folderName || 'EXPLORER'}
        </div>
        <div className="sidebar-actions">
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
          selectedPath={selectedEntry?.path || null}
          onSelect={setSelectedEntry}
          refreshKey={refreshKey}
        />
      </div>
    </div>
  );
};
