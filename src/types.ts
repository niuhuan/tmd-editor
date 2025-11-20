export interface FileEntry {
  name: string;
  path: string;
  is_directory: boolean;
  is_file: boolean;
}

export interface OpenFile {
  path: string;
  name: string;
  content: string;
  originalContent: string;  // Track original content for dirty state
  type: 'txt' | 'markdown' | 'unsupported';
  isUnsupported?: boolean;
  isDirty?: boolean;  // Has unsaved changes
}
