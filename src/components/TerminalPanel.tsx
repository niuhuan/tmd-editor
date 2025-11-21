import React, { useState, useRef } from 'react';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import { Terminal } from './Terminal';
import { useTheme } from '../theme';
import './TerminalPanel.css';

interface TerminalInstance {
  id: string;
  workingDirectory: string | null;
  title: string;
}

interface TerminalPanelProps {
  workingDirectory: string | null;
}

export const TerminalPanel: React.FC<TerminalPanelProps> = ({ workingDirectory }) => {
  const { mode } = useTheme();
  const [terminals, setTerminals] = useState<TerminalInstance[]>([
    { id: '1', workingDirectory, title: 'Terminal 1' }
  ]);
  const [activeTerminalId, setActiveTerminalId] = useState<string>('1');
  const [initializedTerminals, setInitializedTerminals] = useState<Set<string>>(new Set(['1']));
  const nextIdRef = useRef(2);

  const handleNewTerminal = () => {
    const newId = String(nextIdRef.current);
    nextIdRef.current += 1;
    
    const newTerminal: TerminalInstance = {
      id: newId,
      workingDirectory,
      title: `Terminal ${newId}`,
    };
    
    setTerminals(prev => [...prev, newTerminal]);
    setActiveTerminalId(newId);
    // Mark as initialized when switching to it
    setInitializedTerminals(prev => new Set([...prev, newId]));
  };

  const handleCloseTerminal = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    setTerminals(prev => {
      const filtered = prev.filter(t => t.id !== id);
      
      // If closing active terminal, switch to another one
      if (id === activeTerminalId && filtered.length > 0) {
        const currentIndex = prev.findIndex(t => t.id === id);
        const nextIndex = currentIndex > 0 ? currentIndex - 1 : 0;
        const nextId = filtered[nextIndex].id;
        setActiveTerminalId(nextId);
        // Ensure the next terminal is initialized
        setInitializedTerminals(prev => new Set([...prev, nextId]));
      }
      
      return filtered;
    });
    
    // Remove from initialized set
    setInitializedTerminals(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  };

  const handleTabClick = (id: string) => {
    setActiveTerminalId(id);
    // Initialize terminal when first clicked
    setInitializedTerminals(prev => new Set([...prev, id]));
  };

  return (
    <div className={`terminal-panel ${mode}`}>
      <div className="terminal-tabs">
        <div className="terminal-tab-list">
          {terminals.map(terminal => (
            <div
              key={terminal.id}
              className={`terminal-tab ${terminal.id === activeTerminalId ? 'active' : ''} ${mode}`}
              onClick={() => handleTabClick(terminal.id)}
            >
              <span className="terminal-tab-title">{terminal.title}</span>
              {terminals.length > 1 && (
                <button
                  className={`terminal-tab-close ${mode}`}
                  onClick={(e) => handleCloseTerminal(terminal.id, e)}
                  title="Close Terminal"
                >
                  <CloseIcon fontSize="small" />
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          className={`terminal-new-btn ${mode}`}
          onClick={handleNewTerminal}
          title="New Terminal"
        >
          <AddIcon fontSize="small" />
        </button>
      </div>
      <div className="terminal-content-area">
        {terminals.map(terminal => {
          // Only render terminal if it has been initialized (active at least once)
          const shouldRender = initializedTerminals.has(terminal.id);
          const isActive = terminal.id === activeTerminalId;
          
          return shouldRender ? (
            <div
              key={terminal.id}
              className="terminal-instance"
              style={{ display: isActive ? 'flex' : 'none' }}
            >
              <Terminal 
                workingDirectory={terminal.workingDirectory}
                terminalId={terminal.id}
              />
            </div>
          ) : null;
        })}
      </div>
    </div>
  );
};
