import React, { useEffect, useState, useRef } from 'react';
import { marked } from 'marked';
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
import { CodeMirrorEditor } from './CodeMirrorEditor';
import './EditorPane.css';
import '../codemirror-scrollbar.css';

interface EditorPaneProps {
  file: OpenFile;
  isActive: boolean;
  onContentChange: (path: string, content: string) => void;
}

const EditorPaneComponent: React.FC<EditorPaneProps> = ({ file, isActive, onContentChange }) => {
  const { mode } = useTheme();
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const previewRef = useRef<HTMLDivElement | null>(null);

  const handleCodeChange = (value: string) => {
    onContentChange(file.path, value);
  };

  const handleMarkdownChange = (value: string) => {
    onContentChange(file.path, value);
  };

  // Update preview HTML when content changes in split mode
  useEffect(() => {
    if (file.type === 'markdown' && file.markdownViewMode === 'split') {
      const html = marked.parse(file.content);
      setPreviewHtml(html as string);
    }
  }, [file.content, file.type, file.markdownViewMode]);

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

  if (file.type === 'image') {
    // Get file extension to determine MIME type
    const ext = file.name.toLowerCase().split('.').pop() || '';
    let mimeType = 'image/png';
    if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
    else if (ext === 'gif') mimeType = 'image/gif';
    else if (ext === 'bmp') mimeType = 'image/bmp';
    else if (ext === 'webp') mimeType = 'image/webp';
    else if (ext === 'svg') mimeType = 'image/svg+xml';
    else if (ext === 'ico') mimeType = 'image/x-icon';

    return (
      <div className={`editor-pane image-preview ${mode}`}>
        <div className="image-preview-container">
          <div className="image-preview-header">
            <span className="image-info">{file.name}</span>
          </div>
          <div className="image-preview-content">
            <img 
              src={`data:${mimeType};base64,${file.content}`}
              alt={file.name}
              className="preview-image"
            />
          </div>
        </div>
      </div>
    );
  }

  if (file.type === 'markdown') {
    const viewMode = file.markdownViewMode || 'rich';
    
    if (viewMode === 'source') {
      // Show source code in CodeMirror
      return (
        <div className={`editor-pane codemirror ${mode}`}>
          <CodeMirrorEditor
            value={file.content}
            language="markdown"
            theme={mode}
            onChange={handleCodeChange}
            autoFocus={isActive}
          />
        </div>
      );
    }
    
    if (viewMode === 'split') {
      // Show split view: editor on left, preview on right
      return (
        <div className={`editor-pane split-view ${mode}`}>
          <div className="split-editor">
            <CodeMirrorEditor
              value={file.content}
              language="markdown"
              theme={mode}
              onChange={handleCodeChange}
              autoFocus={isActive}
            />
          </div>
          <div 
            ref={previewRef}
            className={`split-preview ${mode}`}
          >
            <div 
              className="markdown-preview-content"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
        </div>
      );
    }
    
    // Show rich editor
    return (
      <div className={`editor-pane markdown ${mode}`}>
        <MDXEditor
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
                  <Separator />
                  <InsertCodeBlock />
                  <Separator />
                  <InsertThematicBreak />
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
            imagePlugin({ imageUploadHandler }),
            tablePlugin(),
            codeBlockPlugin({ defaultCodeBlockLanguage: 'js' }),
            codeMirrorPlugin({ codeBlockLanguages: { js: 'JavaScript', ts: 'TypeScript', py: 'Python', rs: 'Rust', go: 'Go' } }),
          ]}
        />
      </div>
    );
  }

  // All other file types - use CodeMirror with language support
  return (
    <div className={`editor-pane codemirror ${mode}`}>
      <CodeMirrorEditor
        value={file.content}
        language={file.type}
        theme={mode}
        onChange={handleCodeChange}
        autoFocus={isActive}
      />
    </div>
  );
};

// Memoize to prevent unnecessary re-renders when switching tabs
// Only re-render if file path, content, type, view mode, or active state changes
export const EditorPane = React.memo(EditorPaneComponent, (prevProps, nextProps) => {
  return (
    prevProps.file.path === nextProps.file.path &&
    prevProps.file.content === nextProps.file.content &&
    prevProps.file.type === nextProps.file.type &&
    prevProps.file.markdownViewMode === nextProps.file.markdownViewMode &&
    prevProps.isActive === nextProps.isActive
  );
});
