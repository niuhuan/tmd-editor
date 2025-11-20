import React from 'react';
import { useTheme } from '../theme';
import './Editor.css';

interface EditorProps {
  selectedFile?: string;
}

export const Editor: React.FC<EditorProps> = ({ selectedFile }) => {
  const { mode } = useTheme();

  return (
    <div className={`editor ${mode}`}>
      {selectedFile ? (
        <div className={`editor-placeholder ${mode}`}>
          <h2>Editor Coming Soon</h2>
          <p>Selected file: {selectedFile}</p>
          <p>The markdown editor will be implemented here.</p>
        </div>
      ) : (
        <div className={`editor-placeholder ${mode}`}>
          <h1>TMD Editor</h1>
          <p>Open a file from the explorer to start editing</p>
        </div>
      )}
    </div>
  );
};

