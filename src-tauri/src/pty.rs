use portable_pty::{native_pty_system, CommandBuilder, PtySize, Child};
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{AppHandle, Emitter};

pub struct PtySession {
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
    child: Arc<Mutex<Box<dyn Child + Send>>>,
}

impl PtySession {
    pub fn new(app_handle: AppHandle, terminal_id: String, working_dir: Option<String>) -> Result<Self, String> {
        let pty_system = native_pty_system();
        
        // Create a new PTY with default size
        let pair = pty_system
            .openpty(PtySize {
                rows: 24,
                cols: 80,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Failed to create PTY: {}", e))?;

        // Get the default shell based on OS
        let shell = if cfg!(target_os = "windows") {
            "powershell.exe".to_string()
        } else {
            std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".to_string())
        };

        let mut cmd = CommandBuilder::new(&shell);
        
        // Add login shell flag to load .zprofile, .zshrc, etc.
        if !cfg!(target_os = "windows") {
            cmd.arg("-l");  // Login shell flag
        }
        
        // Set working directory if provided
        if let Some(dir) = working_dir {
            cmd.cwd(dir);
        }

        // Spawn the shell in the PTY
        let child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| format!("Failed to spawn shell: {}", e))?;

        let child: Arc<Mutex<Box<dyn Child + Send>>> = Arc::new(Mutex::new(child));
        let child_clone = Arc::clone(&child);

        // Get reader and writer
        let mut reader = pair.master.try_clone_reader().map_err(|e| format!("Failed to clone reader: {}", e))?;
        let writer = pair.master.take_writer().map_err(|e| format!("Failed to get writer: {}", e))?;

        let writer = Arc::new(Mutex::new(writer));

        // Start thread to read from PTY and emit to frontend
        // This will also detect when the shell exits (EOF)
        thread::spawn(move || {
            let mut buffer = [0u8; 4096];
            let mut exit_sent = false;
            
            loop {
                match reader.read(&mut buffer) {
                    Ok(0) => {
                        // EOF - shell has exited
                        if !exit_sent {
                            let _ = app_handle.emit(&format!("terminal-exit-{}", terminal_id), ());
                            exit_sent = true;
                        }
                        break;
                    }
                    Ok(n) => {
                        // Convert bytes to string (UTF-8 lossy conversion for safety)
                        let output = String::from_utf8_lossy(&buffer[..n]).to_string();
                        let _ = app_handle.emit(&format!("terminal-output-{}", terminal_id), output);
                    }
                    Err(_) => {
                        // Error reading - shell has probably exited
                        if !exit_sent {
                            let _ = app_handle.emit(&format!("terminal-exit-{}", terminal_id), ());
                            exit_sent = true;
                        }
                        break;
                    }
                }
            }
        });

        Ok(Self { writer, child })
    }

    pub fn write(&self, data: &str) -> Result<(), String> {
        let mut writer = self.writer.lock().map_err(|e| format!("Failed to lock writer: {}", e))?;
        writer
            .write_all(data.as_bytes())
            .map_err(|e| format!("Failed to write to PTY: {}", e))?;
        writer
            .flush()
            .map_err(|e| format!("Failed to flush PTY: {}", e))?;
        Ok(())
    }

    pub fn kill(&self) -> Result<(), String> {
        let mut child = self.child.lock().map_err(|e| format!("Failed to lock child: {}", e))?;
        child.kill().map_err(|e| format!("Failed to kill child process: {}", e))?;
        Ok(())
    }
}
