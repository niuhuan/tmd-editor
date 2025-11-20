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
  type: 'txt' | 'markdown' | 'unsupported';
  isUnsupported?: boolean;
}
