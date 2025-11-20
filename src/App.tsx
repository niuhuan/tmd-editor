import { useState } from "react";
import { ThemeContext, ThemeMode, lightTheme, darkTheme } from "./theme";
import { ActivityBar } from "./components/ActivityBar";
import { Sidebar } from "./components/Sidebar";
import { Editor } from "./components/Editor";
import { StatusBar } from "./components/StatusBar";
import "./App.css";

function App() {
  const [themeMode, setThemeMode] = useState<ThemeMode>('light');
  const [selectedFile, setSelectedFile] = useState<string | undefined>();

  const toggleTheme = () => {
    setThemeMode(prev => prev === 'light' ? 'dark' : 'light');
  };

  const handleFileClick = (path: string) => {
    setSelectedFile(path);
  };

  const theme = themeMode === 'light' ? lightTheme : darkTheme;

  return (
    <ThemeContext.Provider value={{ mode: themeMode, toggleTheme }}>
      <div 
        className={`app ${themeMode}`}
        style={{ 
          backgroundColor: theme.colors.background,
          color: theme.colors.text 
        }}
      >
        <div className="app-container">
          <ActivityBar />
          <div className="app-sidebar">
            <Sidebar onFileClick={handleFileClick} />
          </div>
          <div className="app-main">
            <Editor selectedFile={selectedFile} />
          </div>
        </div>
        <StatusBar />
      </div>
    </ThemeContext.Provider>
  );
}

export default App;
