import { useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useLsp } from '../contexts/LspContext';
import { detectAllProjectsInDir, SupportedLanguage } from '../services/lsp';

interface LspManagerProps {
  workspacePath: string | null;
  onLspStatusChange: (activeLsps: string[]) => void;
  enableRustLsp: boolean;
  enableGoLsp: boolean;
}

/**
 * Component to manage LSP lifecycle based on workspace changes
 */
export function LspManager({ workspacePath, onLspStatusChange, enableRustLsp, enableGoLsp }: LspManagerProps) {
  const { manager, setActiveLsps } = useLsp();
  const onLspStatusChangeRef = useRef(onLspStatusChange);
  const lastWorkspaceRef = useRef<string | null>(null);
  const lastSettingsRef = useRef({ enableRustLsp, enableGoLsp });

  // Update ref when callback changes
  useEffect(() => {
    onLspStatusChangeRef.current = onLspStatusChange;
  }, [onLspStatusChange]);

  useEffect(() => {
    // Skip if workspace and settings haven't actually changed
    const settingsChanged = 
      lastSettingsRef.current.enableRustLsp !== enableRustLsp ||
      lastSettingsRef.current.enableGoLsp !== enableGoLsp;
    
    if (lastWorkspaceRef.current === workspacePath && !settingsChanged) {
      return;
    }
    
    lastWorkspaceRef.current = workspacePath;
    lastSettingsRef.current = { enableRustLsp, enableGoLsp };

    let mounted = true;

    async function handleWorkspaceChange() {
      if (!workspacePath) {
        // No workspace - stop all LSP servers (silently)
        await manager.stopAll();
        if (mounted) {
          setActiveLsps([]);
          onLspStatusChangeRef.current([]);
        }
        return;
      }

      console.log('[LspManager] Workspace changed to:', workspacePath);
      console.log('[LspManager] LSP settings:', { enableRustLsp, enableGoLsp });
      
      // Stop all existing LSP servers
      await manager.stopAll();
      if (mounted) {
        setActiveLsps([]);
        onLspStatusChangeRef.current([]);
      }

      // Detect all projects in the new workspace
      const projects = await detectAllProjectsInDir(workspacePath);
      console.log('[LspManager] Detected projects:', projects);

      if (projects.length === 0) {
        console.log('[LspManager] No LSP-enabled projects found');
        return;
      }

      // Filter projects based on settings
      const enabledProjects = projects.filter(project => {
        if (project.project_type === 'rust') return enableRustLsp;
        if (project.project_type === 'go') return enableGoLsp;
        return false;
      });

      if (enabledProjects.length === 0) {
        console.log('[LspManager] All detected LSPs are disabled in settings');
        return;
      }

      // Start LSP servers for each enabled project
      const activeLspList: string[] = [];
      for (const project of enabledProjects) {
        try {
          // Check if LSP tool is available
          const isAvailable = await invoke<boolean>('check_lsp_available', { 
            language: project.project_type 
          });

          if (!isAvailable) {
            const lspName = project.project_type === 'rust' ? 'rust-analyzer' : 'gopls';
            let installMsg = '';
            
            if (project.project_type === 'rust') {
              installMsg = `rust-analyzer is not installed or not in PATH.

Installation options:
1. Via rustup (recommended):
   rustup component add rust-analyzer

2. Via cargo:
   cargo install rust-analyzer

3. Download binary from:
   https://github.com/rust-lang/rust-analyzer/releases

After installation, restart the editor.`;
            } else {
              installMsg = `gopls is not installed or not in PATH.

Installation:
go install golang.org/x/tools/gopls@latest

Make sure $GOPATH/bin is in your PATH.

After installation, restart the editor.`;
            }
            
            alert(installMsg);
            console.error(`[LspManager] ${lspName} not available`);
            continue;
          }

          console.log(`[LspManager] Starting ${project.project_type} LSP for ${project.root_path}`);
          await manager.ensureClient(project.project_type as SupportedLanguage, project.root_path);
          activeLspList.push(project.project_type);
        } catch (e: any) {
          console.error(`[LspManager] Failed to start ${project.project_type} LSP:`, e);
          
          const lspName = project.project_type === 'rust' ? 'rust-analyzer' : 'gopls';
          const installCmd = project.project_type === 'rust' 
            ? 'rustup component add rust-analyzer'
            : 'go install golang.org/x/tools/gopls@latest';
          
          alert(`Failed to start ${lspName}.\n\nInstall: ${installCmd}\n\nThen restart the editor.`);
        }
      }

      if (mounted) {
        setActiveLsps(activeLspList);
        onLspStatusChangeRef.current(activeLspList);
        console.log('[LspManager] Active LSPs:', activeLspList);
      }
    }

    handleWorkspaceChange();

    return () => {
      mounted = false;
    };
  }, [workspacePath, enableRustLsp, enableGoLsp, manager, setActiveLsps]);

  // This component doesn't render anything
  return null;
}
