import React from 'react';
import Editor from '@monaco-editor/react';
import { MDXEditor, headingsPlugin, listsPlugin, quotePlugin, thematicBreakPlugin, markdownShortcutPlugin, linkPlugin, linkDialogPlugin, tablePlugin, codeBlockPlugin, codeMirrorPlugin } from '@mdxeditor/editor';
import '@mdxeditor/editor/style.css';
import { OpenFile } from '../types';
import { useTheme } from '../theme';
import './EditorPane.css';

interface EditorPaneProps {
  file: OpenFile;
  onContentChange: (path: string, content: string) => void;
}

export const EditorPane: React.FC<EditorPaneProps> = ({ file, onContentChange }) => {
  const { mode } = useTheme();

  const handleMonacoChange = (value: string | undefined) => {
    if (value !== undefined) {
      onContentChange(file.path, value);
    }
  };

  const handleMarkdownChange = (value: string) => {
    onContentChange(file.path, value);
  };

  if (file.isUnsupported) {
    return (
      <div className={`editor-pane unsupported ${mode}`}>
        <div className="unsupported-message">
          <h2>Unsupported File Type</h2>
          <p>Cannot edit file: {file.name}</p>
          <p className="hint">This file type is not supported for editing.</p>
        </div>
      </div>
    );
  }

  if (file.type === 'markdown') {
    return (
      <div className={`editor-pane markdown ${mode}`}>
        <MDXEditor
          key={file.path}
          markdown={file.content}
          onChange={handleMarkdownChange}
          contentEditableClassName="markdown-editor-content"
          plugins={[
            headingsPlugin(),
            listsPlugin(),
            quotePlugin(),
            thematicBreakPlugin(),
            markdownShortcutPlugin(),
            linkPlugin(),
            linkDialogPlugin(),
            tablePlugin(),
            codeBlockPlugin({ defaultCodeBlockLanguage: 'txt' }),
            codeMirrorPlugin({ codeBlockLanguages: { txt: 'Text', js: 'JavaScript', ts: 'TypeScript', jsx: 'JSX', tsx: 'TSX', css: 'CSS', html: 'HTML', json: 'JSON', python: 'Python', rust: 'Rust' } }),
          ]}
        />
      </div>
    );
  }

  // Text editor (Monaco)
  return (
    <div className={`editor-pane monaco ${mode}`}>
      <Editor
        height="100%"
        defaultLanguage="plaintext"
        value={file.content}
        onChange={handleMonacoChange}
        theme={mode === 'dark' ? 'vs-dark' : 'vs-light'}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: 'on',
          wordWrap: 'on',
          automaticLayout: true,
        }}
      />
    </div>
  );
};

