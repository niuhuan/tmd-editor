import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import FolderIcon from '@mui/icons-material/Folder';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { FileEntry } from '../types';
import { useTheme } from '../theme';
import './FileTree.css';

interface FileTreeNodeProps {
  entry: FileEntry;
  level: number;
  onFileClick?: (path: string) => void;
  selectedPath?: string | null;
  onSelect?: (entry: FileEntry) => void;
}

const FileTreeNode: React.FC<FileTreeNodeProps> = ({ entry, level, onFileClick, selectedPath, onSelect }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [children, setChildren] = useState<FileEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { mode } = useTheme();

  const loadChildren = async () => {
    if (!entry.is_directory || isLoading) return;
    
    setIsLoading(true);
    try {
      const result = await invoke<FileEntry[]>('read_directory', { path: entry.path });
      setChildren(result);
    } catch (error) {
      console.error('Failed to read directory:', error);
      setChildren([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClick = async () => {
    // Always select the item first
    if (onSelect) {
      onSelect(entry);
    }
    
    if (entry.is_directory) {
      if (!isExpanded && children.length === 0) {
        await loadChildren();
      }
      setIsExpanded(!isExpanded);
    } else if (entry.is_file && onFileClick) {
      onFileClick(entry.path);
    }
  };

  return (
    <div className="file-tree-node">
      <div
        className={`file-tree-item ${mode} ${selectedPath === entry.path ? 'selected' : ''}`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={handleClick}
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
        <span className="file-name">{entry.name}</span>
      </div>
      {isExpanded && entry.is_directory && (
        <div className="file-tree-children">
          {children.map((child) => (
            <FileTreeNode
              key={child.path}
              entry={child}
              level={level + 1}
              onFileClick={onFileClick}
              selectedPath={selectedPath}
              onSelect={onSelect}
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
  selectedPath?: string | null;
  onSelect?: (entry: FileEntry) => void;
  refreshKey?: number;
}

export const FileTree: React.FC<FileTreeProps> = ({ rootPath, onFileClick, selectedPath, onSelect, refreshKey }) => {
  const [rootEntries, setRootEntries] = useState<FileEntry[]>([]);
  const { mode } = useTheme();

  useEffect(() => {
    if (rootPath) {
      loadRootDirectory();
    }
  }, [rootPath, refreshKey]);

  const loadRootDirectory = async () => {
    if (!rootPath) return;
    
    try {
      const result = await invoke<FileEntry[]>('read_directory', { path: rootPath });
      setRootEntries(result);
    } catch (error) {
      console.error('Failed to read root directory:', error);
      setRootEntries([]);
    }
  };

  if (!rootPath) {
    return null;
  }

  return (
    <div className={`file-tree ${mode}`}>
      {rootEntries.map((entry) => (
        <FileTreeNode
          key={entry.path}
          entry={entry}
          level={0}
          onFileClick={onFileClick}
          selectedPath={selectedPath}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
};

