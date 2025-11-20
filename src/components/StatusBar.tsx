import React from 'react';
import { OpenFile } from '../types';
import { useTheme } from '../theme';
import './StatusBar.css';

interface StatusBarProps {
  activeFile: OpenFile | null;
}

export const StatusBar: React.FC<StatusBarProps> = ({ activeFile }) => {
  const { mode } = useTheme();

  const getFileTypeLabel = (file: OpenFile | null): string => {
    if (!file) return '';
    
    switch (file.type) {
      case 'markdown':
        return 'Markdown';
      case 'txt':
        return 'Plain Text';
      case 'unsupported':
        return 'Unsupported';
      default:
        return '';
    }
  };

  return (
    <div className={`status-bar ${mode}`}>
      <div className="status-bar-left">
        <span className="status-bar-item">TMD Editor v0.1.0</span>
      </div>
      <div className="status-bar-right">
        {activeFile && (
          <span className="status-bar-item">{getFileTypeLabel(activeFile)}</span>
        )}
      </div>
    </div>
  );
};

