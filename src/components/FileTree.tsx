import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import FolderIcon from '@mui/icons-material/Folder';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { FileEntry } from '../types';
import { useTheme } from '../theme';
import { ContextMenu, ContextMenuItem } from './ContextMenu';
import './FileTree.css';

interface FileTreeNodeProps {
  entry: FileEntry;
  level: number;
  onFileClick?: (path: string) => void;
  selectedPaths: Set<string>;
  onSelect: (path: string, isMulti: boolean, isRange: boolean) => void;
  refreshKey?: number;
  showHiddenFiles?: boolean;
  onRename: (oldPath: string, newPath: string) => void;
  onDelete: (paths: string[]) => void;
  onCreateFile: (parentPath: string) => void;
  onCreateFolder: (parentPath: string) => void;
  renamingPath: string | null;
  onRenamingChange: (path: string | null) => void;
}

const FileTreeNode: React.FC<FileTreeNodeProps> = ({ 
  entry, 
  level, 
  onFileClick, 
  selectedPaths, 
  onSelect,
  refreshKey, 
  showHiddenFiles = true,
  onRename,
  onDelete,
  onCreateFile,
  onCreateFolder,
  renamingPath,
  onRenamingChange,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [children, setChildren] = useState<FileEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newName, setNewName] = useState(entry.name);
  const { mode } = useTheme();
  const inputRef = useRef<HTMLInputElement>(null);

  const loadChildren = async (showHidden: boolean) => {
    if (!entry.is_directory || isLoading) return;
    
    setIsLoading(true);
    try {
      const result = await invoke<FileEntry[]>('read_directory', { 
        path: entry.path,
        showHidden
      });
      setChildren(result);
    } catch (error) {
      console.error('Failed to read directory:', error);
      setChildren([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isExpanded && entry.is_directory) {
      loadChildren(showHiddenFiles);
    }
  }, [refreshKey, showHiddenFiles]);

  useEffect(() => {
    if (renamingPath === entry.path && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [renamingPath]);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    const isMulti = e.metaKey || e.ctrlKey;
    const isRange = e.shiftKey;
    
    // Don't open file in multi-select mode
    if (!isMulti && !isRange) {
      if (entry.is_directory) {
        if (!isExpanded && children.length === 0) {
          await loadChildren(showHiddenFiles);
        }
        setIsExpanded(!isExpanded);
      } else if (entry.is_file && onFileClick) {
        onFileClick(entry.path);
      }
    }
    
    onSelect(entry.path, isMulti, isRange);
  };

  const handleRenameSubmit = () => {
    if (newName && newName !== entry.name) {
      const parentPath = entry.path.substring(0, entry.path.lastIndexOf('/'));
      const newPath = `${parentPath}/${newName}`;
      onRename(entry.path, newPath);
    }
    onRenamingChange(null);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRenameSubmit();
    } else if (e.key === 'Escape') {
      setNewName(entry.name);
      onRenamingChange(null);
    }
  };

  const isSelected = selectedPaths.has(entry.path);
  const isRenaming = renamingPath === entry.path;

  return (
    <div className="file-tree-node">
      <div
        className={`file-tree-item ${mode} ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={handleClick}
        onContextMenu={(e) => {
          e.preventDefault();
          // Don't stop propagation - let it bubble to parent
        }}
        data-path={entry.path}
      >
        <span className="expand-icon">
          {entry.is_directory ? (
            isExpanded ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />
          ) : (
            <span style={{ width: 20, display: 'inline-block' }} />
          )}
        </span>
        <span className="file-icon">
          {entry.is_directory ? (
            isExpanded ? <FolderOpenIcon fontSize="small" /> : <FolderIcon fontSize="small" />
          ) : (
            <InsertDriveFileIcon fontSize="small" />
          )}
        </span>
        {isRenaming ? (
          <input
            ref={inputRef}
            type="text"
            className={`file-rename-input ${mode}`}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={handleRenameKeyDown}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="file-name">{entry.name}</span>
        )}
      </div>
      {isExpanded && entry.is_directory && (
        <div className="file-tree-children">
          {children.map((child) => (
            <FileTreeNode
              key={child.path}
              entry={child}
              level={level + 1}
              onFileClick={onFileClick}
              selectedPaths={selectedPaths}
              onSelect={onSelect}
              refreshKey={refreshKey}
              showHiddenFiles={showHiddenFiles}
              onRename={onRename}
              onDelete={onDelete}
              onCreateFile={onCreateFile}
              onCreateFolder={onCreateFolder}
              renamingPath={renamingPath}
              onRenamingChange={onRenamingChange}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface FileTreeProps {
  rootPath: string | null;
  onFileClick?: (path: string) => void;
  activeFilePath?: string | null;
  refreshKey?: number;
  showHiddenFiles?: boolean;
  onRefreshNeeded?: () => void;
}

export const FileTree: React.FC<FileTreeProps> = ({ 
  rootPath, 
  onFileClick, 
  activeFilePath,
  refreshKey, 
  showHiddenFiles = true,
  onRefreshNeeded
}) => {
  const [rootEntries, setRootEntries] = useState<FileEntry[]>([]);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [lastSelectedPath, setLastSelectedPath] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const { mode } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync selection with active file
  useEffect(() => {
    if (activeFilePath && !selectedPaths.has(activeFilePath)) {
      setSelectedPaths(new Set([activeFilePath]));
      setLastSelectedPath(activeFilePath);
    }
  }, [activeFilePath]);

  useEffect(() => {
    if (rootPath) {
      loadRootDirectory();
    }
  }, [rootPath, refreshKey, showHiddenFiles]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+A / Ctrl+A - Select all
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault();
        const allPaths = getAllPaths(rootEntries);
        setSelectedPaths(new Set(allPaths));
        if (allPaths.length > 0) {
          setLastSelectedPath(allPaths[allPaths.length - 1]);
        }
      }
      
      // Escape - Clear selection
      if (e.key === 'Escape') {
        setSelectedPaths(new Set());
        setLastSelectedPath(null);
      }
    };

    // Also add global listener for when hovering over file tree
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (container.matches(':hover')) {
        handleKeyDown(e);
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keydown', handleGlobalKeyDown);
    
    return () => {
      container.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [rootEntries]);

  const loadRootDirectory = async () => {
    if (!rootPath) return;
    
    try {
      const result = await invoke<FileEntry[]>('read_directory', { 
        path: rootPath,
        showHidden: showHiddenFiles
      });
      setRootEntries(result);
    } catch (error) {
      console.error('Failed to read root directory:', error);
      setRootEntries([]);
    }
  };

  const getAllEntries = (entries: FileEntry[]): FileEntry[] => {
    let allEntries: FileEntry[] = [];
    entries.forEach(entry => {
      allEntries.push(entry);
      // Note: We can't easily get children here without loading them
    });
    return allEntries;
  };

  const getAllPaths = (entries: FileEntry[]): string[] => {
    return entries.map(entry => entry.path);
  };

  const handleSelect = (path: string, isMulti: boolean, isRange: boolean) => {
    if (isRange && lastSelectedPath) {
      // Range selection with Shift
      const allEntries = getAllEntries(rootEntries);
      const startIndex = allEntries.findIndex(e => e.path === lastSelectedPath);
      const endIndex = allEntries.findIndex(e => e.path === path);
      
      if (startIndex !== -1 && endIndex !== -1) {
        const [start, end] = startIndex < endIndex ? [startIndex, endIndex] : [endIndex, startIndex];
        const newSelection = new Set(selectedPaths);
        for (let i = start; i <= end; i++) {
          newSelection.add(allEntries[i].path);
        }
        setSelectedPaths(newSelection);
      }
    } else if (isMulti) {
      // Multi-selection with Cmd/Ctrl
      const newSelection = new Set(selectedPaths);
      if (newSelection.has(path)) {
        newSelection.delete(path);
      } else {
        newSelection.add(path);
      }
      setSelectedPaths(newSelection);
      setLastSelectedPath(path);
    } else {
      // Single selection
      setSelectedPaths(new Set([path]));
      setLastSelectedPath(path);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    
    // Find if we clicked on an entry
    const target = e.target as HTMLElement;
    const itemElement = target.closest('.file-tree-item');
    
    console.log('Context menu triggered', { 
      target: target.className,
      itemElement: itemElement?.className,
      dataPath: itemElement?.getAttribute('data-path')
    });
    
    if (itemElement) {
      const clickedPath = itemElement.getAttribute('data-path');
      if (clickedPath) {
        if (!selectedPaths.has(clickedPath)) {
          // Clicked on unselected item, select only it
          setSelectedPaths(new Set([clickedPath]));
          setLastSelectedPath(clickedPath);
        }
        // If clicked on selected item, keep current selection
      }
    } else {
      // Clicked on empty space
      setSelectedPaths(new Set());
      setLastSelectedPath(null);
    }
    
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleRename = async (oldPath: string, newPath: string) => {
    try {
      await invoke('rename_path', { oldPath, newPath });
      onRefreshNeeded?.();
    } catch (error) {
      console.error('Failed to rename:', error);
      alert(`Failed to rename: ${error}`);
    }
  };

  const handleDelete = async (paths: string[]) => {
    const confirmed = confirm(`Are you sure you want to delete ${paths.length} item(s)?`);
    if (!confirmed) return;

    try {
      for (const path of paths) {
        await invoke('delete_path', { path });
      }
      setSelectedPaths(new Set());
      onRefreshNeeded?.();
    } catch (error) {
      console.error('Failed to delete:', error);
      alert(`Failed to delete: ${error}`);
    }
  };

  const handleCreateFile = async (parentPath: string) => {
    const fileName = prompt('Enter file name:');
    if (!fileName) return;

    const filePath = `${parentPath}/${fileName}`;
    try {
      await invoke('create_file', { path: filePath });
      onRefreshNeeded?.();
    } catch (error) {
      console.error('Failed to create file:', error);
      alert(`Failed to create file: ${error}`);
    }
  };

  const handleCreateFolder = async (parentPath: string) => {
    const folderName = prompt('Enter folder name:');
    if (!folderName) return;

    const folderPath = `${parentPath}/${folderName}`;
    try {
      await invoke('create_directory', { path: folderPath });
      onRefreshNeeded?.();
    } catch (error) {
      console.error('Failed to create folder:', error);
      alert(`Failed to create folder: ${error}`);
    }
  };

  const findEntryByPath = (entries: FileEntry[], path: string): FileEntry | null => {
    for (const entry of entries) {
      if (entry.path === path) return entry;
    }
    return null;
  };

  const getContextMenuItems = (): ContextMenuItem[] => {
    const selected = Array.from(selectedPaths);
    const items: ContextMenuItem[] = [];

    if (selected.length === 0) {
      // Empty space menu
      items.push({
        label: 'New File',
        onClick: () => rootPath && handleCreateFile(rootPath),
      });
      items.push({
        label: 'New Folder',
        onClick: () => rootPath && handleCreateFolder(rootPath),
      });
    } else if (selected.length === 1) {
      // Single selection menu
      const entry = findEntryByPath(rootEntries, selected[0]);
      
      if (entry?.is_directory) {
        items.push({
          label: 'New File',
          onClick: () => handleCreateFile(selected[0]),
        });
        items.push({
          label: 'New Folder',
          onClick: () => handleCreateFolder(selected[0]),
        });
        items.push({ label: '', onClick: () => {}, separator: true });
      }
      
      items.push({
        label: 'Rename',
        onClick: () => setRenamingPath(selected[0]),
      });
      items.push({ label: '', onClick: () => {}, separator: true });
      items.push({
        label: 'Delete',
        onClick: () => handleDelete(selected),
      });
    } else {
      // Multi-selection menu
      items.push({
        label: `Delete ${selected.length} items`,
        onClick: () => handleDelete(selected),
      });
    }

    return items;
  };

  if (!rootPath) {
    return null;
  }

  return (
    <>
      <div 
        ref={containerRef}
        className={`file-tree ${mode}`}
        onContextMenu={handleContextMenu}
        tabIndex={0}
      >
        {rootEntries.map((entry) => (
          <FileTreeNode
            key={entry.path}
            entry={entry}
            level={0}
            onFileClick={onFileClick}
            selectedPaths={selectedPaths}
            onSelect={handleSelect}
            refreshKey={refreshKey}
            showHiddenFiles={showHiddenFiles}
            onRename={handleRename}
            onDelete={handleDelete}
            onCreateFile={handleCreateFile}
            onCreateFolder={handleCreateFolder}
            renamingPath={renamingPath}
            onRenamingChange={setRenamingPath}
          />
        ))}
      </div>
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={getContextMenuItems()}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  );
};
