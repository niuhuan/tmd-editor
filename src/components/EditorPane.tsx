import React, { useEffect, useState, useRef } from 'react';
import Editor from '@monaco-editor/react';
import type { editor as MonacoEditor } from 'monaco-editor';
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
import './EditorPane.css';

interface EditorPaneProps {
  file: OpenFile;
  onContentChange: (path: string, content: string) => void;
}

const EditorPaneComponent: React.FC<EditorPaneProps> = ({ file, onContentChange }) => {
  const { mode } = useTheme();
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const isScrollingRef = useRef<{ editor: boolean; preview: boolean }>({ editor: false, preview: false });

  const handleMonacoChange = (value: string | undefined) => {
    if (value !== undefined) {
      onContentChange(file.path, value);
    }
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

  // Setup scroll synchronization for split view
  useEffect(() => {
    if (file.type !== 'markdown' || file.markdownViewMode !== 'split') {
      return;
    }

    let editorScrollDisposable: any = null;
    let previewScrollHandler: ((e: Event) => void) | null = null;

    // Wait for both editor and preview to be ready, and for DOM to update
    const timer = setTimeout(() => {
      const editor = editorRef.current;
      const preview = previewRef.current;

      if (!editor || !preview) {
        return;
      }

      // Sync preview scroll when editor scrolls
      editorScrollDisposable = editor.onDidScrollChange((e) => {
        if (isScrollingRef.current.preview) return;
        
        isScrollingRef.current.editor = true;
        
        const scrollTop = e.scrollTop;
        const scrollHeight = editor.getScrollHeight();
        const clientHeight = editor.getLayoutInfo().height;
        
        const maxScroll = scrollHeight - clientHeight;
        if (maxScroll <= 0) {
          isScrollingRef.current.editor = false;
          return;
        }
        
        const scrollPercentage = scrollTop / maxScroll;
        
        const previewMaxScroll = preview.scrollHeight - preview.clientHeight;
        if (previewMaxScroll > 0) {
          preview.scrollTop = scrollPercentage * previewMaxScroll;
        }
        
        setTimeout(() => {
          isScrollingRef.current.editor = false;
        }, 100);
      });

      // Sync editor scroll when preview scrolls
      previewScrollHandler = () => {
        if (isScrollingRef.current.editor) return;
        
        isScrollingRef.current.preview = true;
        
        const scrollTop = preview.scrollTop;
        const scrollHeight = preview.scrollHeight;
        const clientHeight = preview.clientHeight;
        
        const maxScroll = scrollHeight - clientHeight;
        if (maxScroll <= 0) {
          isScrollingRef.current.preview = false;
          return;
        }
        
        const scrollPercentage = scrollTop / maxScroll;
        
        const editorMaxScroll = editor.getScrollHeight() - editor.getLayoutInfo().height;
        if (editorMaxScroll > 0) {
          editor.setScrollTop(scrollPercentage * editorMaxScroll);
        }
        
        setTimeout(() => {
          isScrollingRef.current.preview = false;
        }, 100);
      };

      preview.addEventListener('scroll', previewScrollHandler);
    }, 100);

    return () => {
      clearTimeout(timer);
      if (editorScrollDisposable) {
        editorScrollDisposable.dispose();
      }
      if (previewScrollHandler && previewRef.current) {
        previewRef.current.removeEventListener('scroll', previewScrollHandler);
      }
    };
  }, [file.type, file.markdownViewMode, previewHtml]);

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
      // Show source code in Monaco Editor
      return (
        <div className={`editor-pane monaco ${mode}`}>
          <Editor
            height="100%"
            path={file.path}
            defaultLanguage="markdown"
            defaultValue={file.content}
            onChange={handleMonacoChange}
            theme={mode === 'dark' ? 'vs-dark' : 'vs-light'}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              lineNumbers: 'on',
              wordWrap: 'off',
              automaticLayout: true,
              scrollBeyondLastLine: false,
              scrollbar: {
                vertical: 'visible',
                horizontal: 'visible',
                useShadows: false,
                verticalScrollbarSize: 10,
                horizontalScrollbarSize: 10,
              },
            }}
          />
        </div>
      );
    }
    
    if (viewMode === 'split') {
      // Show split view: editor on left, preview on right
      return (
        <div className={`editor-pane split-view ${mode}`}>
          <div className="split-editor">
            <Editor
              height="100%"
              path={file.path}
              defaultLanguage="markdown"
              defaultValue={file.content}
              onChange={handleMonacoChange}
              onMount={(editor) => {
                editorRef.current = editor;
              }}
              theme={mode === 'dark' ? 'vs-dark' : 'vs-light'}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: 'on',
                wordWrap: 'off',
                automaticLayout: true,
                scrollBeyondLastLine: false,
                scrollbar: {
                  vertical: 'visible',
                  horizontal: 'visible',
                  useShadows: false,
                  verticalScrollbarSize: 10,
                  horizontalScrollbarSize: 10,
                },
              }}
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
        path={file.path}
        defaultLanguage="plaintext"
        defaultValue={file.content}
        onChange={handleMonacoChange}
        theme={mode === 'dark' ? 'vs-dark' : 'vs-light'}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: 'on',
          wordWrap: 'off',  // Disable word wrap to avoid IME composition issues
          automaticLayout: true,
          scrollBeyondLastLine: false,
          scrollbar: {
            vertical: 'visible',
            horizontal: 'visible',
            useShadows: false,
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10,
          },
        }}
      />
    </div>
  );
};

// Memoize to prevent unnecessary re-renders when switching tabs
// Only re-render if file path, content, type, or view mode changes
export const EditorPane = React.memo(EditorPaneComponent, (prevProps, nextProps) => {
  return (
    prevProps.file.path === nextProps.file.path &&
    prevProps.file.content === nextProps.file.content &&
    prevProps.file.type === nextProps.file.type &&
    prevProps.file.markdownViewMode === nextProps.file.markdownViewMode
  );
});

