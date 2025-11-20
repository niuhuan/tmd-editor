import React from 'react';
import FolderIcon from '@mui/icons-material/Folder';
import SearchIcon from '@mui/icons-material/Search';
import GitHubIcon from '@mui/icons-material/GitHub';
import ExtensionIcon from '@mui/icons-material/Extension';
import SettingsIcon from '@mui/icons-material/Settings';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import { useTheme } from '../theme';
import './ActivityBar.css';

interface ActivityBarProps {
  onSettingsClick?: () => void;
}

export const ActivityBar: React.FC<ActivityBarProps> = ({ onSettingsClick }) => {
  const { mode, toggleTheme } = useTheme();

  return (
    <div className={`activity-bar ${mode}`}>
      <div className="activity-bar-items">
        <div className={`activity-bar-item active ${mode}`} title="Explorer">
          <FolderIcon />
        </div>
        <div className={`activity-bar-item ${mode}`} title="Search">
          <SearchIcon />
        </div>
        <div className={`activity-bar-item ${mode}`} title="Source Control">
          <GitHubIcon />
        </div>
        <div className={`activity-bar-item ${mode}`} title="Extensions">
          <ExtensionIcon />
        </div>
      </div>
      <div className="activity-bar-items">
        <div 
          className={`activity-bar-item ${mode}`} 
          title={`Switch to ${mode === 'light' ? 'Dark' : 'Light'} Theme`}
          onClick={toggleTheme}
        >
          {mode === 'light' ? <DarkModeIcon /> : <LightModeIcon />}
        </div>
        <div 
          className={`activity-bar-item ${mode}`} 
          title="Settings"
          onClick={onSettingsClick}
        >
          <SettingsIcon />
        </div>
      </div>
    </div>
  );
};

