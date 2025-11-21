import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { useTheme } from '../theme';
import '@xterm/xterm/css/xterm.css';
import './Terminal.css';

interface TerminalProps {
  workingDirectory: string | null;
  terminalId?: string;
}

export const Terminal: React.FC<TerminalProps> = ({ workingDirectory, terminalId }) => {
  const { mode } = useTheme();
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const unlistenOutputRef = useRef<UnlistenFn | null>(null);
  const unlistenExitRef = useRef<UnlistenFn | null>(null);
  const isInitializedRef = useRef(false);
  const [isSessionActive, setIsSessionActive] = useState(true);

  // Initialize xterm instance only once per terminal instance
  useEffect(() => {
    if (!terminalRef.current || xtermRef.current) return;

    // Create xterm instance
    const xterm = new XTerm({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace",
      theme: mode === 'dark' ? {
        background: '#1e1e1e',
        foreground: '#cccccc',
        cursor: '#cccccc',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#e5e5e5',
      } : {
        background: '#ffffff',
        foreground: '#333333',
        cursor: '#333333',
        black: '#000000',
        red: '#cd3131',
        green: '#00bc00',
        yellow: '#949800',
        blue: '#0451a5',
        magenta: '#bc05bc',
        cyan: '#0598bc',
        white: '#555555',
        brightBlack: '#666666',
        brightRed: '#cd3131',
        brightGreen: '#14ce14',
        brightYellow: '#b5ba00',
        brightBlue: '#0451a5',
        brightMagenta: '#bc05bc',
        brightCyan: '#0598bc',
        brightWhite: '#a5a5a5',
      },
      allowProposedApi: true,
    });

    // Add addons
    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    xterm.loadAddon(new WebLinksAddon());

    // Open terminal
    xterm.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    // Handle resize
    const handleResize = () => {
      fitAddon.fit();
    };
    window.addEventListener('resize', handleResize);

    // Cleanup on unmount
    return () => {
      window.removeEventListener('resize', handleResize);
      if (unlistenOutputRef.current) {
        unlistenOutputRef.current();
      }
      if (unlistenExitRef.current) {
        unlistenExitRef.current();
      }
      if (terminalId) {
        invoke('stop_pty_session', { terminalId }).catch(console.error);
      }
      xterm.dispose();
      xtermRef.current = null;
      isInitializedRef.current = false;
    };
  }, [mode]);

  // Start PTY session - only once per terminal instance
  useEffect(() => {
    if (!xtermRef.current || isInitializedRef.current) return;

    const startSession = async () => {
      const xterm = xtermRef.current;
      if (!xterm || isInitializedRef.current) return;
      
      try {
        isInitializedRef.current = true;
        
        // Start PTY session first
        await invoke('start_pty_session', { 
          terminalId,
          workingDir: workingDirectory || undefined 
        });
        
        // Session started successfully, now set up listeners
        setIsSessionActive(true);
        
        // Listen for terminal output (specific to this terminal)
        const unlistenOutput = await listen<string>(`terminal-output-${terminalId}`, (event) => {
          xterm.write(event.payload);
        });
        unlistenOutputRef.current = unlistenOutput;

        // Listen for session exit (specific to this terminal)
        // Only listen after session is confirmed started
        const unlistenExit = await listen(`terminal-exit-${terminalId}`, () => {
          setIsSessionActive(false);
          xterm.writeln('\r\n\x1b[90m[Process completed]\x1b[0m');
        });
        unlistenExitRef.current = unlistenExit;

        // Handle terminal input
        xterm.onData((data) => {
          if (isSessionActive) {
            invoke('write_to_pty', { terminalId, data }).catch((error) => {
              console.error('Failed to write to PTY:', error);
            });
          }
          // If session is inactive, ignore input (no restart)
        });
      } catch (error) {
        console.error('Failed to start PTY session:', error);
        xterm.writeln('\x1b[31mError: Failed to start terminal session\x1b[0m');
        setIsSessionActive(false);
      }
    };

    startSession();
  }, [workingDirectory]);

  // Update theme when mode changes
  useEffect(() => {
    if (!xtermRef.current) return;

    xtermRef.current.options.theme = mode === 'dark' ? {
      background: '#1e1e1e',
      foreground: '#cccccc',
      cursor: '#cccccc',
      black: '#000000',
      red: '#cd3131',
      green: '#0dbc79',
      yellow: '#e5e510',
      blue: '#2472c8',
      magenta: '#bc3fbc',
      cyan: '#11a8cd',
      white: '#e5e5e5',
      brightBlack: '#666666',
      brightRed: '#f14c4c',
      brightGreen: '#23d18b',
      brightYellow: '#f5f543',
      brightBlue: '#3b8eea',
      brightMagenta: '#d670d6',
      brightCyan: '#29b8db',
      brightWhite: '#e5e5e5',
    } : {
      background: '#ffffff',
      foreground: '#333333',
      cursor: '#333333',
      black: '#000000',
      red: '#cd3131',
      green: '#00bc00',
      yellow: '#949800',
      blue: '#0451a5',
      magenta: '#bc05bc',
      cyan: '#0598bc',
      white: '#555555',
      brightBlack: '#666666',
      brightRed: '#cd3131',
      brightGreen: '#14ce14',
      brightYellow: '#b5ba00',
      brightBlue: '#0451a5',
      brightMagenta: '#bc05bc',
      brightCyan: '#0598bc',
      brightWhite: '#a5a5a5',
    };
  }, [mode]);

  // Handle resize when terminal becomes visible
  useEffect(() => {
    const timer = setTimeout(() => {
      fitAddonRef.current?.fit();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleClear = () => {
    xtermRef.current?.clear();
  };

  return (
    <div className={`terminal ${mode}`}>
      <div className="terminal-header">
        <span className="terminal-title">
          Terminal
          {!isSessionActive && (
            <span className="terminal-status inactive"> (Ended)</span>
          )}
        </span>
        <div className="terminal-actions">
          <button 
            className={`terminal-btn ${mode}`}
            onClick={handleClear}
            title="Clear"
          >
            Clear
          </button>
        </div>
      </div>
      <div className="terminal-xterm" ref={terminalRef} />
    </div>
  );
};
