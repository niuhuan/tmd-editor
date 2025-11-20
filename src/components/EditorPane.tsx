import React from 'react';
import Editor from '@monaco-editor/react';
import { 
  MDXEditor, 
  headingsPlugin, 
  listsPlugin, 
  quotePlugin, 
  thematicBreakPlugin, 
  markdownShortcutPlugin, 
  linkPlugin, 
  linkDialogPlugin, 
  tablePlugin, 
  codeBlockPlugin, 
  codeMirrorPlugin,
  imagePlugin,
  toolbarPlugin,
  UndoRedo,
  BoldItalicUnderlineToggles,
  BlockTypeSelect,
  CreateLink,
  InsertImage,
  InsertTable,
  InsertThematicBreak,
  ListsToggle,
  Separator,
  InsertCodeBlock
} from '@mdxeditor/editor';
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

  // Image upload handler - for now, just use the provided URL/path directly
  const imageUploadHandler = async (image: File): Promise<string> => {
    // For local files, we can use file:// protocol or data URL
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve(e.target?.result as string);
      };
      reader.readAsDataURL(image);
    });
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
    const viewMode = file.markdownViewMode || 'rich';
    
    if (viewMode === 'source') {
      // Show source code in Monaco Editor
      return (
        <div className={`editor-pane monaco ${mode}`}>
          <Editor
            height="100%"
            defaultLanguage="markdown"
            value={file.content}
            onChange={handleMonacoChange}
            theme={mode === 'dark' ? 'vs-dark' : 'vs-light'}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              lineNumbers: 'on',
              wordWrap: 'off',
              automaticLayout: true,
              scrollBeyondLastLine: false,
            }}
          />
        </div>
      );
    }
    
    // Show rich editor
    return (
      <div className={`editor-pane markdown ${mode}`}>
        <MDXEditor
          key={file.path}
          markdown={file.content}
          onChange={handleMarkdownChange}
          contentEditableClassName="markdown-editor-content"
          plugins={[
            toolbarPlugin({
              toolbarContents: () => (
                <>
                  <UndoRedo />
                  <Separator />
                  <BoldItalicUnderlineToggles />
                  <Separator />
                  <BlockTypeSelect />
                  <Separator />
                  <CreateLink />
                  <InsertImage />
                  <Separator />
                  <ListsToggle />
                  <Separator />
                  <InsertTable />
                  <InsertThematicBreak />
                  <Separator />
                  <InsertCodeBlock />
                </>
              ),
            }),
            headingsPlugin(),
            listsPlugin(),
            quotePlugin(),
            thematicBreakPlugin(),
            markdownShortcutPlugin(),
            linkPlugin(),
            linkDialogPlugin(),
            imagePlugin({
              imageUploadHandler,
            }),
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
          wordWrap: 'off',  // Disable word wrap to avoid IME composition issues
          automaticLayout: true,
          scrollBeyondLastLine: false,
        }}
      />
    </div>
  );
};

