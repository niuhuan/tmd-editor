import React from 'react';
import TerminalIcon from '@mui/icons-material/Terminal';
import { OpenFile } from '../types';
import { useTheme } from '../theme';
import './StatusBar.css';

interface StatusBarProps {
  activeFile: OpenFile | null;
  showTerminal?: boolean;
  onToggleTerminal?: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({ activeFile, showTerminal, onToggleTerminal }) => {
  const { mode } = useTheme();

  const getFileTypeLabel = (file: OpenFile | null): string => {
    if (!file) return '';
    
    const typeMap: Record<string, string> = {
      // JavaScript/TypeScript
      javascript: 'JavaScript',
      typescript: 'TypeScript',
      jsx: 'JSX',
      tsx: 'TSX',
      // Python
      python: 'Python',
      // Rust & Go
      rust: 'Rust',
      go: 'Go',
      // Java
      java: 'Java',
      // C/C++/C#
      cpp: 'C++',
      c: 'C',
      csharp: 'C#',
      // PHP
      php: 'PHP',
      // HTML/CSS/SCSS/SASS/LESS
      html: 'HTML',
      css: 'CSS',
      scss: 'SCSS',
      sass: 'Sass',
      less: 'Less',
      // JSON/XML/YAML/TOML
      json: 'JSON',
      xml: 'XML',
      yaml: 'YAML',
      toml: 'TOML',
      // Markdown
      markdown: 'Markdown',
      // SQL
      sql: 'SQL',
      // Plain text
      txt: 'Plain Text',
      plaintext: 'Plain Text',
      // Image & Unsupported
      image: 'Image',
      unsupported: 'Unsupported',
    };
    
    return typeMap[file.type] || file.type.toUpperCase();
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
        {onToggleTerminal && (
          <button
            className={`status-bar-btn ${mode} ${showTerminal ? 'active' : ''}`}
            onClick={onToggleTerminal}
            title="Toggle Terminal"
          >
            <TerminalIcon fontSize="small" />
          </button>
        )}
      </div>
    </div>
  );
};

