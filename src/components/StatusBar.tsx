import React from 'react';
import { useTheme } from '../theme';
import './StatusBar.css';

export const StatusBar: React.FC = () => {
  const { mode } = useTheme();

  return (
    <div className={`status-bar ${mode}`}>
      <div className="status-bar-left">
        <span className="status-bar-item">TMD Editor v0.1.0</span>
      </div>
      <div className="status-bar-right">
        <span className="status-bar-item">UTF-8</span>
        <span className="status-bar-item">Markdown</span>
      </div>
    </div>
  );
};

