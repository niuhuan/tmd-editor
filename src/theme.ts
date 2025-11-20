import { createContext, useContext } from 'react';

export type ThemeMode = 'light' | 'dark';

export interface ThemeContextType {
  mode: ThemeMode;
  toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextType>({
  mode: 'light',
  toggleTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

export const lightTheme = {
  colors: {
    // VSCode Light Theme
    background: '#ffffff',
    sidebar: '#f3f3f3',
    sidebarBorder: '#e5e5e5',
    editor: '#ffffff',
    activityBar: '#2c2c2c',
    activityBarForeground: '#ffffff',
    statusBar: '#007acc',
    statusBarForeground: '#ffffff',
    text: '#333333',
    textSecondary: '#616161',
    border: '#e5e5e5',
    hover: '#e8e8e8',
    selected: '#e0e0e0',
    folderIcon: '#dcb67a',
    fileIcon: '#858585',
  },
};

export const darkTheme = {
  colors: {
    // VSCode Dark Theme
    background: '#1e1e1e',
    sidebar: '#252526',
    sidebarBorder: '#3e3e42',
    editor: '#1e1e1e',
    activityBar: '#333333',
    activityBarForeground: '#ffffff',
    statusBar: '#007acc',
    statusBarForeground: '#ffffff',
    text: '#cccccc',
    textSecondary: '#858585',
    border: '#3e3e42',
    hover: '#2a2d2e',
    selected: '#37373d',
    folderIcon: '#dcb67a',
    fileIcon: '#c5c5c5',
  },
};

