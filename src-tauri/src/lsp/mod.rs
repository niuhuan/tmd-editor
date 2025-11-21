use std::collections::HashMap;
use std::io;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Arc;
use tokio::sync::Mutex;

use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio::process::{Child, Command};
use tokio_tungstenite::tungstenite::Message;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum LspLanguage {
    Rust,
    Go,
}

#[derive(Debug, Clone, Serialize)]
pub struct StartLspResult {
    pub lsp_id: String,
    pub port: u16,
}

struct LspProcess {
    #[allow(dead_code)]
    child: Child,
}

struct LspServer {
    #[allow(dead_code)]
    language: LspLanguage,
    #[allow(dead_code)]
    root_path: PathBuf,
    port: u16,
    _ws_task: tokio::task::JoinHandle<()>,
    _stdout_task: tokio::task::JoinHandle<()>,
}

impl LspServer {
    async fn spawn(language: LspLanguage, root_path: PathBuf) -> io::Result<Self> {
        eprintln!("[LSP] Starting {:?} server for: {}", language, root_path.display());
        
        // 1) Spawn the language server process
        let mut cmd = match language {
            LspLanguage::Rust => Command::new("rust-analyzer"),
            LspLanguage::Go => {
                let mut c = Command::new("gopls");
                c.arg("serve");
                c
            }
        };
        
        cmd.current_dir(&root_path)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit());

        let mut child = cmd.spawn()?;
        let stdin = child.stdin.take().ok_or_else(|| io::Error::new(io::ErrorKind::Other, "No stdin"))?;
        let stdout = child.stdout.take().ok_or_else(|| io::Error::new(io::ErrorKind::Other, "No stdout"))?;

        let _proc = Arc::new(Mutex::new(LspProcess { child }));
        
        // Separate stdin and stdout - NO SHARED MUTEX!
        let stdin = Arc::new(Mutex::new(stdin));
        let stdout = Arc::new(Mutex::new(stdout));
        
        let clients: Arc<Mutex<Vec<tokio::sync::mpsc::UnboundedSender<String>>>> = Arc::new(Mutex::new(Vec::new()));

        // 2) Start WebSocket server on random port
        let listener = TcpListener::bind("127.0.0.1:0").await?;
        let port = listener.local_addr()?.port();
        
        eprintln!("[LSP] WebSocket server bound to port {}", port);

        let clients_clone = clients.clone();

        // Use oneshot to ensure WebSocket server is ready
        let (ready_tx, ready_rx) = tokio::sync::oneshot::channel();
        let port_for_log = port;
        
        // WebSocket acceptor task
        let ws_task = tokio::spawn(async move {
            // Signal ready immediately after task starts
            let _ = ready_tx.send(());
            eprintln!("[LSP] WebSocket acceptor ready on port {}", port_for_log);
            
            while let Ok((stream, _addr)) = listener.accept().await {
                eprintln!("[LSP] Client connecting...");
                
                let ws_stream = match tokio_tungstenite::accept_async(stream).await {
                    Ok(s) => {
                        eprintln!("[LSP] WebSocket handshake successful");
                        s
                    },
                    Err(e) => {
                        eprintln!("[LSP] WebSocket handshake failed: {}", e);
                        continue;
                    }
                };

                let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<String>();
                {
                    let mut list = clients_clone.lock().await;
                    list.push(tx);
                }

                let (mut sink, mut stream) = ws_stream.split();
                let stdin_for_ws = stdin.clone();

                // Client -> LSP
                let writer_task = tokio::spawn(async move {
                    while let Some(Ok(msg)) = stream.next().await {
                        if let Message::Text(text) = msg {
                            eprintln!("[LSP] → Received from WebSocket: {} bytes", text.len());
                            eprintln!("[LSP] Message preview: {}", &text[..text.len().min(200)]);
                            
                            // Prepare the full message before locking
                            let content_len = text.as_bytes().len();
                            let header = format!("Content-Length: {}\r\n\r\n", content_len);
                            let mut full_message = Vec::new();
                            full_message.extend_from_slice(header.as_bytes());
                            full_message.extend_from_slice(text.as_bytes());
                            
                            eprintln!("[LSP] Prepared message: header={}, body={}, total={}", 
                                header.len(), text.len(), full_message.len());
                            
                            // Now lock stdin ONLY (not stdout!)
                            let mut stdin_guard = stdin_for_ws.lock().await;
                            eprintln!("[LSP] Got stdin lock, writing...");
                            
                            if let Err(e) = stdin_guard.write_all(&full_message).await {
                                eprintln!("[LSP] Write error: {}", e);
                                break;
                            }
                            eprintln!("[LSP] Write complete, flushing...");
                            
                            if let Err(e) = stdin_guard.flush().await {
                                eprintln!("[LSP] Flush error: {}", e);
                                break;
                            }
                            // Release lock immediately
                            drop(stdin_guard);
                            
                            eprintln!("[LSP] ✓ Sent to LSP successfully (total {} bytes)", full_message.len());
                        }
                    }
                    eprintln!("[LSP] Writer task ended");
                });

                // LSP -> Client
                let forward_task = tokio::spawn(async move {
                    while let Some(msg) = rx.recv().await {
                        if let Err(e) = sink.send(Message::Text(msg)).await {
                            eprintln!("[LSP] Forward error: {}", e);
                            break;
                        }
                    }
                });

                let _ = (writer_task, forward_task);
            }
        });

        // Read from LSP stdout and broadcast to all clients
        let stdout_for_reader = stdout.clone();
        let clients_for_stdout = clients.clone();
        let stdout_task = tokio::spawn(async move {
            let mut buf = Vec::new();
            loop {
                // Read LSP header
                let mut header = Vec::new();
                {
                    let mut stdout_guard = stdout_for_reader.lock().await;
                    let mut last4 = [0u8; 4];
                    loop {
                        let mut byte = [0u8; 1];
                        if let Err(e) = stdout_guard.read_exact(&mut byte).await {
                            eprintln!("[LSP] Read error (header): {}", e);
                            return;
                        }
                        header.push(byte[0]);
                        last4[0] = last4[1];
                        last4[1] = last4[2];
                        last4[2] = last4[3];
                        last4[3] = byte[0];
                        if last4 == [b'\r', b'\n', b'\r', b'\n'] {
                            break;
                        }
                    }
                }

                // Parse Content-Length
                let header_str = String::from_utf8_lossy(&header);
                let mut content_length: usize = 0;
                for line in header_str.split("\r\n") {
                    if let Some(rest) = line.to_ascii_lowercase().strip_prefix("content-length:") {
                        if let Ok(n) = rest.trim().parse::<usize>() {
                            content_length = n;
                        }
                    }
                }
                
                if content_length == 0 {
                    eprintln!("[LSP] Missing Content-Length");
                    continue;
                }

                // Read body
                buf.clear();
                buf.resize(content_length, 0);
                {
                    let mut stdout_guard = stdout_for_reader.lock().await;
                    if let Err(e) = stdout_guard.read_exact(&mut buf).await {
                        eprintln!("[LSP] Read error (body): {}", e);
                        return;
                    }
                }
                
                let text = match String::from_utf8(buf.clone()) {
                    Ok(s) => s,
                    Err(e) => {
                        eprintln!("[LSP] UTF-8 error: {}", e);
                        continue;
                    }
                };

                eprintln!("[LSP] ← Received from LSP: {} bytes", text.len());

                // Broadcast to all clients
                let list = clients_for_stdout.lock().await;
                eprintln!("[LSP] Broadcasting to {} client(s)", list.len());
                for sender in list.iter() {
                    let _ = sender.send(text.clone());
                }
            }
        });

        // Wait for WebSocket server to be ready
        ready_rx.await.map_err(|_| io::Error::new(io::ErrorKind::Other, "WebSocket task failed"))?;
        eprintln!("[LSP] Server fully initialized on port {}", port);

        Ok(Self {
            language,
            root_path,
            port,
            _ws_task: ws_task,
            _stdout_task: stdout_task,
        })
    }
}

#[derive(Default)]
pub struct LspState {
    servers: Mutex<HashMap<String, LspServer>>,
}

#[tauri::command]
pub async fn start_lsp_server(
    state: tauri::State<'_, LspState>,
    language: String,
    root_path: String,
) -> Result<StartLspResult, String> {
    let lang = match language.as_str() {
        "rust" => LspLanguage::Rust,
        "go" => LspLanguage::Go,
        _ => return Err(format!("Unsupported language: {}", language)),
    };

    let id = Uuid::new_v4().to_string();
    let server = LspServer::spawn(lang, PathBuf::from(&root_path))
        .await
        .map_err(|e| format!("Failed to start LSP: {}", e))?;

    let port = server.port;
    {
        let mut map = state.servers.lock().await;
        map.insert(id.clone(), server);
    }

    eprintln!("[LSP] Started with ID: {}, port: {}", id, port);
    Ok(StartLspResult { lsp_id: id, port })
}

#[tauri::command]
pub async fn stop_lsp_server(
    state: tauri::State<'_, LspState>,
    lsp_id: String,
) -> Result<(), String> {
    let mut map = state.servers.lock().await;
    if let Some(server) = map.remove(&lsp_id) {
        eprintln!("[LSP] Stopped server: {}", lsp_id);
        drop(server);
        Ok(())
    } else {
        Err(format!("No LSP server with id: {}", lsp_id))
    }
}

#[derive(Debug, Serialize)]
pub struct ProjectInfo {
    pub project_type: String,
    pub root_path: String,
}

#[tauri::command]
pub async fn detect_project_type(path: String) -> Result<ProjectInfo, String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err("Path does not exist".to_string());
    }
    
    // Walk up to find Cargo.toml or go.mod
    let mut cur = p.as_path();
    loop {
        if let Some(parent) = cur.parent() {
            let cargo_toml = parent.join("Cargo.toml");
            if cargo_toml.exists() {
                return Ok(ProjectInfo {
                    project_type: "rust".to_string(),
                    root_path: parent.to_string_lossy().to_string(),
                });
            }
            
            let go_mod = parent.join("go.mod");
            if go_mod.exists() {
                return Ok(ProjectInfo {
                    project_type: "go".to_string(),
                    root_path: parent.to_string_lossy().to_string(),
                });
            }
            
            cur = parent;
        } else {
            break;
        }
    }
    
    Err("unknown".to_string())
}

#[tauri::command]
pub async fn check_lsp_available(language: String) -> Result<bool, String> {
    use std::process::Command;
    
    let (cmd_name, args) = match language.as_str() {
        "rust" => ("rust-analyzer", vec!["--version"]),
        "go" => ("gopls", vec!["version"]),
        _ => return Err(format!("Unknown language: {}", language)),
    };
    
    match Command::new(cmd_name).args(&args).output() {
        Ok(output) => {
            let stderr = String::from_utf8_lossy(&output.stderr);
            let stdout = String::from_utf8_lossy(&output.stdout);
            
            // Check if stderr contains "error" or "Error" (case-insensitive)
            let has_error = stderr.to_lowercase().contains("error");
            
            // Also check if the command actually succeeded
            let success = output.status.success() && !has_error;
            
            if !success {
                eprintln!("[LSP] {} check failed:", cmd_name);
                eprintln!("  Exit code: {:?}", output.status.code());
                eprintln!("  Stderr: {}", stderr);
                eprintln!("  Stdout: {}", stdout);
            } else {
                eprintln!("[LSP] {} available: {}", cmd_name, stdout.trim());
            }
            
            Ok(success)
        }
        Err(e) => {
            eprintln!("[LSP] {} not found in PATH: {}", cmd_name, e);
            Ok(false)
        }
    }
}

