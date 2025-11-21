import React, { useRef, useEffect } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView } from '@codemirror/view';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { rust } from '@codemirror/lang-rust';
import { go } from '@codemirror/lang-go';
import { java } from '@codemirror/lang-java';
import { cpp } from '@codemirror/lang-cpp';
import { php } from '@codemirror/lang-php';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { sass } from '@codemirror/lang-sass';
import { less } from '@codemirror/lang-less';
import { json } from '@codemirror/lang-json';
import { xml } from '@codemirror/lang-xml';
import { markdown } from '@codemirror/lang-markdown';
import { sql } from '@codemirror/lang-sql';
import { yaml } from '@codemirror/lang-yaml';
import { oneDark } from '@codemirror/theme-one-dark';
import { FileType } from '../types';

interface CodeMirrorEditorProps {
  value: string;
  language: FileType;
  theme: 'light' | 'dark';
  onChange: (value: string) => void;
  readOnly?: boolean;
  autoFocus?: boolean;
}

// Map file types to CodeMirror language extensions
const getLanguageExtension = (language: FileType) => {
  switch (language) {
    case 'javascript':
    case 'jsx':
      return javascript({ jsx: true });
    case 'typescript':
    case 'tsx':
      return javascript({ jsx: true, typescript: true });
    case 'python':
      return python();
    case 'rust':
      return rust();
    case 'go':
      return go();
    case 'java':
      return java();
    case 'cpp':
    case 'c':
    case 'csharp':
      return cpp();
    case 'php':
      return php();
    case 'html':
      return html();
    case 'css':
      return css();
    case 'scss':
    case 'sass':
      return sass();
    case 'less':
      return less();
    case 'json':
      return json();
    case 'xml':
      return xml();
    case 'markdown':
      return markdown();
    case 'sql':
      return sql();
    case 'yaml':
    case 'toml':
      return yaml();
    case 'txt':
    case 'plaintext':
    default:
      return []; // Plain text, no highlighting
  }
};

export const CodeMirrorEditor: React.FC<CodeMirrorEditorProps> = ({
  value,
  language,
  theme,
  onChange,
  readOnly = false,
  autoFocus = false,
}) => {
  const editorViewRef = useRef<EditorView | null>(null);
  const extensions = [getLanguageExtension(language)];

  // Auto-focus when component becomes active
  useEffect(() => {
    if (autoFocus && editorViewRef.current) {
      setTimeout(() => {
        editorViewRef.current?.focus();
      }, 50);
    }
  }, [autoFocus]);

  return (
    <CodeMirror
      value={value}
      height="100%"
      theme={theme === 'dark' ? oneDark : 'light'}
      extensions={extensions}
      onChange={onChange}
      readOnly={readOnly}
      onCreateEditor={(view) => {
        editorViewRef.current = view;
        if (autoFocus) {
          view.focus();
        }
      }}
      basicSetup={{
        lineNumbers: true,
        highlightActiveLineGutter: true,
        highlightSpecialChars: true,
        foldGutter: true,
        drawSelection: true,
        dropCursor: true,
        allowMultipleSelections: true,
        indentOnInput: true,
        syntaxHighlighting: true,
        bracketMatching: true,
        closeBrackets: true,
        autocompletion: true,
        rectangularSelection: true,
        crosshairCursor: true,
        highlightActiveLine: true,
        highlightSelectionMatches: true,
        closeBracketsKeymap: true,
        searchKeymap: true,
        foldKeymap: true,
        completionKeymap: true,
        lintKeymap: true,
      }}
      style={{
        height: '100%',
        fontSize: '14px',
      }}
    />
  );
};

