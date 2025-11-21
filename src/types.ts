export interface FileEntry {
  name: string;
  path: string;
  is_directory: boolean;
  is_file: boolean;
}

export type FileType = 
  | 'javascript' | 'typescript' | 'jsx' | 'tsx'
  | 'python' | 'rust' | 'go' | 'java' | 'cpp' | 'c' | 'csharp'
  | 'php' | 'html' | 'css' | 'scss' | 'sass' | 'less'
  | 'json' | 'xml' | 'yaml' | 'toml'
  | 'markdown' | 'sql'
  | 'txt' | 'plaintext'
  | 'image' | 'unsupported';

export interface OpenFile {
  path: string;
  name: string;
  content: string;
  originalContent: string;  // Track original content for dirty state
  type: FileType;
  isUnsupported?: boolean;
  isDirty?: boolean;  // Has unsaved changes
  markdownViewMode?: 'rich' | 'source' | 'split';  // Markdown view mode: rich (WYSIWYG), source (code only), split (side-by-side)
}
