import React, { useEffect, useState, useRef } from 'react';
import { marked } from 'marked';
import { invoke } from '@tauri-apps/api/core';
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
  const editorScrollerRef = useRef<HTMLDivElement | null>(null);
  const isScrollingRef = useRef<{ editor: boolean; preview: boolean }>({ editor: false, preview: false });

  const handleCodeChange = (value: string) => {
    onContentChange(file.path, value);
  };

  // Helper function to resolve relative path to absolute path
  const resolveImagePath = (imagePath: string, markdownFilePath: string): string => {
    // If it's already a data URL or HTTP(S) URL, return as is
    if (imagePath.startsWith('data:') || imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }

    // If it's a file:// URL, extract the path
    if (imagePath.startsWith('file://')) {
      return imagePath.slice(7); // Remove 'file://' prefix
    }

    // Get directory of markdown file
    // Handle both Windows (\) and Unix (/) path separators
    const markdownDir = markdownFilePath.replace(/[/\\][^/\\]*$/, '');
    
    // Normalize path separators to forward slashes for processing
    const normalizedPath = imagePath.replace(/\\/g, '/');
    const normalizedDir = markdownDir.replace(/\\/g, '/');
    
    // Check if the directory path is absolute (starts with / on Unix, or C:\ on Windows)
    const isAbsoluteDir = normalizedDir.startsWith('/') || /^[A-Za-z]:/.test(normalizedDir);
    
    // Handle absolute paths (starts with / on Unix, or C:\ on Windows)
    if (normalizedPath.match(/^[A-Za-z]:\/|^\/[^\/]/)) {
      // Absolute path - return as is (but normalize separators)
      return normalizedPath;
    }
    
    // Handle relative paths
    // Split into parts and resolve ..
    const dirParts = normalizedDir.split('/').filter(p => p !== '');
    const pathParts = normalizedPath.split('/');
    const resolvedParts = [...dirParts];
    
    for (const part of pathParts) {
      if (part === '..') {
        if (resolvedParts.length > 0) {
          resolvedParts.pop();
        }
      } else if (part !== '.' && part !== '') {
        resolvedParts.push(part);
      }
    }
    
    // Reconstruct path with appropriate separator
    // On Windows, if original path had backslashes, use them
    const useBackslash = markdownFilePath.includes('\\');
    const separator = useBackslash ? '\\' : '/';
    const resolvedPath = resolvedParts.join(separator);
    
    // If the original directory was absolute, ensure the result starts with /
    // For Unix paths, add leading / if it was absolute
    if (isAbsoluteDir && !useBackslash && !resolvedPath.startsWith('/')) {
      return '/' + resolvedPath;
    }
    
    // For Windows absolute paths (C:\), preserve the drive letter
    if (isAbsoluteDir && useBackslash && /^[A-Za-z]:/.test(markdownDir)) {
      const driveMatch = markdownDir.match(/^([A-Za-z]:)/);
      if (driveMatch && !resolvedPath.startsWith(driveMatch[1])) {
        return driveMatch[1] + '\\' + resolvedPath;
      }
    }
    
    return resolvedPath;
  };

  // Helper function to get MIME type from file extension
  const getMimeType = (path: string): string => {
    const ext = path.toLowerCase().split('.').pop() || '';
    const mimeTypes: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'bmp': 'image/bmp',
      'webp': 'image/webp',
      'svg': 'image/svg+xml',
      'ico': 'image/x-icon',
    };
    return mimeTypes[ext] || 'image/png';
  };

  // Process markdown content to convert local image paths to base64 data URLs
  const processMarkdownImages = async (markdownContent: string, markdownFilePath: string): Promise<string> => {
    // Match markdown image syntax: ![alt](path) or ![alt](path "title")
    const markdownImageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    
    // Match HTML img tags: <img src="path" ...>
    const htmlImageRegex = /<img\s+[^>]*src=["']([^"']+)["'][^>]*>/gi;

    let processedContent = markdownContent;
    
    // Collect all image replacements to do
    interface ImageReplacement {
      original: string;
      replacement: string;
    }
    
    const replacements: ImageReplacement[] = [];
    const imageLoadPromises: Promise<void>[] = [];

    // Process markdown image syntax
    let match;
    while ((match = markdownImageRegex.exec(markdownContent)) !== null) {
      const [fullMatch, alt, imagePath] = match;
      const resolvedPath = resolveImagePath(imagePath.trim(), markdownFilePath);
      
      // Only process local file paths (not data URLs or HTTP URLs)
      if (!resolvedPath.startsWith('data:') && !resolvedPath.startsWith('http://') && !resolvedPath.startsWith('https://')) {
        const promise = (async () => {
          try {
            const base64 = await invoke<string>('read_image_file', { path: resolvedPath });
            const mimeType = getMimeType(resolvedPath);
            const dataUrl = `data:${mimeType};base64,${base64}`;
            replacements.push({
              original: fullMatch,
              replacement: `![${alt}](${dataUrl})`
            });
          } catch (error) {
            console.error(`Failed to load image: ${resolvedPath}`, error);
            // Keep original path if loading fails
          }
        })();
        imageLoadPromises.push(promise);
      }
    }

    // Process HTML img tags
    while ((match = htmlImageRegex.exec(markdownContent)) !== null) {
      const imagePath = match[1];
      const resolvedPath = resolveImagePath(imagePath.trim(), markdownFilePath);
      
      // Only process local file paths
      if (!resolvedPath.startsWith('data:') && !resolvedPath.startsWith('http://') && !resolvedPath.startsWith('https://')) {
        const promise = (async () => {
          try {
            const base64 = await invoke<string>('read_image_file', { path: resolvedPath });
            const mimeType = getMimeType(resolvedPath);
            const dataUrl = `data:${mimeType};base64,${base64}`;
            // Replace only the src attribute value
            const fullMatch = match[0];
            const newMatch = fullMatch.replace(`src="${imagePath}"`, `src="${dataUrl}"`).replace(`src='${imagePath}'`, `src='${dataUrl}'`);
            replacements.push({
              original: fullMatch,
              replacement: newMatch
            });
          } catch (error) {
            console.error(`Failed to load image: ${resolvedPath}`, error);
            // Keep original path if loading fails
          }
        })();
        imageLoadPromises.push(promise);
      }
    }

    // Wait for all images to be loaded
    await Promise.all(imageLoadPromises);

    // Apply all replacements
    for (const { original, replacement } of replacements) {
      processedContent = processedContent.replace(original, replacement);
    }

    return processedContent;
  };

  // Update preview HTML when content changes in split or rich mode
  useEffect(() => {
    if (file.type === 'markdown' && (file.markdownViewMode === 'split' || file.markdownViewMode === 'rich')) {
      // Process images and then render markdown
      processMarkdownImages(file.content, file.path).then((processedContent) => {
        const html = marked.parse(processedContent);
        setPreviewHtml(html as string);
      }).catch((error) => {
        console.error('Failed to process markdown images:', error);
        // Fallback to rendering without image processing
        const html = marked.parse(file.content);
        setPreviewHtml(html as string);
      });
    }
  }, [file.content, file.type, file.markdownViewMode, file.path]);

  // Update preview HTML when content changes in split or rich mode
  useEffect(() => {
    if (file.type === 'markdown' && (file.markdownViewMode === 'split' || file.markdownViewMode === 'rich')) {
      // Process images and then render markdown
      processMarkdownImages(file.content, file.path).then((processedContent) => {
        const html = marked.parse(processedContent);
        setPreviewHtml(html as string);
      }).catch((error) => {
        console.error('Failed to process markdown images:', error);
        // Fallback to rendering without image processing
        const html = marked.parse(file.content);
        setPreviewHtml(html as string);
      });
    }
  }, [file.content, file.type, file.markdownViewMode, file.path]);

  // Setup scroll synchronization for split view
  useEffect(() => {
    if (file.type !== 'markdown' || file.markdownViewMode !== 'split') {
      return;
    }

    // Wait for DOM to be ready
    const timer = setTimeout(() => {
      const preview = previewRef.current;
      // Find CodeMirror scroller element
      const editorScroller = document.querySelector('.split-editor .cm-scroller') as HTMLDivElement;
      
      if (!editorScroller || !preview) {
        return;
      }

      editorScrollerRef.current = editorScroller;

      // Sync preview scroll when editor scrolls
      const handleEditorScroll = () => {
        if (isScrollingRef.current.preview || !preview || !editorScroller) return;
        
        isScrollingRef.current.editor = true;
        
        const scrollTop = editorScroller.scrollTop;
        const scrollHeight = editorScroller.scrollHeight;
        const clientHeight = editorScroller.clientHeight;
        
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
      };

      // Sync editor scroll when preview scrolls
      const handlePreviewScroll = () => {
        if (isScrollingRef.current.editor || !preview || !editorScroller) return;
        
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
        
        const editorMaxScroll = editorScroller.scrollHeight - editorScroller.clientHeight;
        if (editorMaxScroll > 0) {
          editorScroller.scrollTop = scrollPercentage * editorMaxScroll;
        }
        
        setTimeout(() => {
          isScrollingRef.current.preview = false;
        }, 100);
      };

      editorScroller.addEventListener('scroll', handleEditorScroll);
      preview.addEventListener('scroll', handlePreviewScroll);

      return () => {
        editorScroller.removeEventListener('scroll', handleEditorScroll);
        preview.removeEventListener('scroll', handlePreviewScroll);
      };
    }, 150); // Increased delay to ensure CodeMirror is fully rendered

    return () => {
      clearTimeout(timer);
    };
  }, [file.type, file.markdownViewMode, previewHtml]);


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
            filePath={file.path}
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
              filePath={file.path}
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
    
    // Show rich editor as preview-only mode (using the same preview component as split mode)
    return (
      <div className={`editor-pane markdown-preview ${mode}`}>
        <div 
          ref={previewRef}
          className={`markdown-preview-full ${mode}`}
        >
          <div 
            className="markdown-preview-content"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </div>
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
        filePath={file.path}
      />
    </div>
  );
};

// Memoize to prevent unnecessary re-renders when switching tabs
// Only re-render if file path, content, type, view mode, or active state changes
export const EditorPane = React.memo(EditorPaneComponent, (prevProps, nextProps) => {
  // Only re-render if file content or type changes
  // isActive changes should NOT trigger re-render (it only affects autoFocus)
  return (
    prevProps.file.path === nextProps.file.path &&
    prevProps.file.content === nextProps.file.content &&
    prevProps.file.type === nextProps.file.type &&
    prevProps.file.markdownViewMode === nextProps.file.markdownViewMode
    // Removed isActive from comparison to prevent unnecessary re-renders
  );
});
