import { invoke } from '@tauri-apps/api/core';
import { LSPClient, type Transport, languageServerExtensions } from '@codemirror/lsp-client';

export type SupportedLanguage = 'rust' | 'go';

export interface StartLspResult {
  lsp_id: string;
  port: number;
}

export interface ProjectInfo {
  project_type: SupportedLanguage;
  root_path: string;
}

/**
 * LSP Manager - manages multiple LSP servers
 * Each project root + language combination gets its own LSP server on a random port
 */
export class LspManager {
  // Key: "rust:/path/to/project" or "go:/path/to/project"
  private clients = new Map<string, LSPClient>();
  private lspIds = new Map<string, string>();
  private ports = new Map<string, number>();

  /**
   * Detect project type from file path
   */
  async detectProject(filePath: string): Promise<ProjectInfo | null> {
    try {
      console.log('[LspManager] Detecting project for:', filePath);
      const info = await invoke<{ project_type: string; root_path: string }>('detect_project_type', { path: filePath });
      
      if (info.project_type === 'rust' || info.project_type === 'go') {
        console.log('[LspManager] Project detected:', info);
        return info as ProjectInfo;
      }
    } catch (e) {
      console.log('[LspManager] No project detected:', e);
    }
    return null;
  }

  /**
   * Get or create LSP client for a project
   */
  async ensureClient(language: SupportedLanguage, rootPath: string): Promise<LSPClient> {
    const key = `${language}:${rootPath}`;
    
    // Return existing client if available
    const existing = this.clients.get(key);
    if (existing) {
      console.log('[LspManager] Reusing existing client for:', key);
      return existing;
    }

    console.log('[LspManager] Creating new client for:', key);

    // Start LSP server on backend
    const result = await invoke<StartLspResult>('start_lsp_server', {
      language,
      rootPath,
    });

    console.log('[LspManager] LSP server started:', result);
    this.lspIds.set(key, result.lsp_id);
    this.ports.set(key, result.port);

    // Create WebSocket connection
    const url = `ws://localhost:${result.port}`;
    const handlers = new Set<(value: string) => void>();
    let ws: WebSocket | null = null;

    const transport: Transport = {
      send: (message: string) => {
        console.log('[LspManager] → Sending to LSP:', message.substring(0, 100) + '...');
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        } else {
          console.error('[LspManager] WebSocket not ready! State:', ws?.readyState);
        }
      },
      subscribe: (handler: (value: string) => void) => {
        handlers.add(handler);
      },
      unsubscribe: (handler: (value: string) => void) => {
        handlers.delete(handler);
      },
    };

    // Create LSP client
    const client = new LSPClient({
      rootUri: `file://${rootPath}`,
      timeout: 30000, // Increase to 30 seconds
      extensions: languageServerExtensions(),
    });

    // Connect WebSocket with retry
    const connectWithRetry = async (maxRetries = 5): Promise<void> => {
      for (let i = 0; i < maxRetries; i++) {
        try {
          console.log(`[LspManager] Connecting to ${url} (attempt ${i + 1}/${maxRetries})...`);
          
          ws = await new Promise<WebSocket>((resolve, reject) => {
            const socket = new WebSocket(url);
            const timeout = setTimeout(() => {
              socket.close();
              reject(new Error('Connection timeout'));
            }, 5000);

            socket.onopen = () => {
              clearTimeout(timeout);
              console.log('[LspManager] WebSocket connected');
              resolve(socket);
            };

            socket.onerror = (e) => {
              clearTimeout(timeout);
              socket.close();
              reject(e);
            };
          });

          // Setup message handler
          ws.onmessage = (ev) => {
            const text = typeof ev.data === 'string' ? ev.data : '';
            console.log('[LspManager] ← Received from LSP:', text.substring(0, 200) + '...');
            console.log('[LspManager] Notifying', handlers.size, 'handler(s)');
            handlers.forEach(h => {
              try {
                h(text);
              } catch (e) {
                console.error('[LspManager] Handler error:', e);
              }
            });
          };

          ws.onclose = () => {
            console.log('[LspManager] WebSocket closed');
          };

          ws.onerror = (err) => {
            console.error('[LspManager] WebSocket error:', err);
          };

          // Connect LSP client
          client.connect(transport);
          console.log('[LspManager] LSP client connected');
          break;
          
        } catch (e) {
          console.log(`[LspManager] Connection attempt ${i + 1} failed:`, e);
          if (i < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, 200 * (i + 1)));
          } else {
            throw new Error(`Failed to connect after ${maxRetries} attempts`);
          }
        }
      }
    };

    await connectWithRetry();

    // Store client
    this.clients.set(key, client);
    console.log('[LspManager] Client ready for:', key);
    
    return client;
  }

  /**
   * Stop an LSP server
   */
  async stopClient(language: SupportedLanguage, rootPath: string): Promise<void> {
    const key = `${language}:${rootPath}`;
    
    const client = this.clients.get(key);
    const lspId = this.lspIds.get(key);

    if (client) {
      client.disconnect();
      this.clients.delete(key);
    }

    if (lspId) {
      try {
        await invoke('stop_lsp_server', { lspId });
      } catch (e) {
        console.error('[LspManager] Failed to stop server:', e);
      }
      this.lspIds.delete(key);
    }

    this.ports.delete(key);
    console.log('[LspManager] Stopped client for:', key);
  }

  /**
   * Get client if exists
   */
  getClient(language: SupportedLanguage, rootPath: string): LSPClient | null {
    const key = `${language}:${rootPath}`;
    return this.clients.get(key) || null;
  }

  /**
   * Stop all LSP servers
   */
  async stopAll(): Promise<void> {
    const keys = Array.from(this.clients.keys());
    for (const key of keys) {
      const [language, rootPath] = key.split(':');
      await this.stopClient(language as SupportedLanguage, rootPath);
    }
  }
}

/**
 * Determine language from file path
 */
export function languageIdForPath(path: string): SupportedLanguage | null {
  if (path.endsWith('.rs')) return 'rust';
  if (path.endsWith('.go')) return 'go';
  return null;
}

/**
 * Convert file path to URI
 */
export function fileUri(path: string): string {
  return `file://${path}`;
}

/**
 * Detect all project types in a directory
 */
export async function detectAllProjectsInDir(dirPath: string): Promise<ProjectInfo[]> {
  const projects: ProjectInfo[] = [];
  
  try {
    // Try to detect Rust project
    const rustInfo = await invoke<{ project_type: string; root_path: string }>('detect_project_type', { 
      path: `${dirPath}/Cargo.toml` 
    });
    if (rustInfo.project_type === 'rust') {
      projects.push(rustInfo as ProjectInfo);
    }
  } catch (e) {
    // No Rust project
  }
  
  try {
    // Try to detect Go project
    const goInfo = await invoke<{ project_type: string; root_path: string }>('detect_project_type', { 
      path: `${dirPath}/go.mod` 
    });
    if (goInfo.project_type === 'go') {
      projects.push(goInfo as ProjectInfo);
    }
  } catch (e) {
    // No Go project
  }
  
  return projects;
}

