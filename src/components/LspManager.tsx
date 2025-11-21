import { useEffect, useRef } from 'react';
import { useLsp } from '../contexts/LspContext';
import { detectAllProjectsInDir } from '../services/lsp';

interface LspManagerProps {
  workspacePath: string | null;
  onLspStatusChange: (activeLsps: string[]) => void;
}

/**
 * Component to manage LSP lifecycle based on workspace changes
 */
export function LspManager({ workspacePath, onLspStatusChange }: LspManagerProps) {
  const { manager, setActiveLsps } = useLsp();
  const onLspStatusChangeRef = useRef(onLspStatusChange);
  const lastWorkspaceRef = useRef<string | null>(null);

  // Update ref when callback changes
  useEffect(() => {
    onLspStatusChangeRef.current = onLspStatusChange;
  }, [onLspStatusChange]);

  useEffect(() => {
    // Skip if workspace hasn't actually changed
    if (lastWorkspaceRef.current === workspacePath) {
      return;
    }
    lastWorkspaceRef.current = workspacePath;

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

      // Start LSP servers for each detected project
      const activeLspList: string[] = [];
      for (const project of projects) {
        try {
          console.log(`[LspManager] Starting ${project.project_type} LSP for ${project.root_path}`);
          await manager.ensureClient(project.project_type, project.root_path);
          activeLspList.push(project.project_type);
        } catch (e) {
          console.error(`[LspManager] Failed to start ${project.project_type} LSP:`, e);
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
  }, [workspacePath, manager, setActiveLsps]);

  // This component doesn't render anything
  return null;
}

