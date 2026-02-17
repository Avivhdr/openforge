// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod db;
mod opencode_manager;
mod opencode_client;

use std::sync::Mutex;
use tauri::Manager;
use opencode_manager::OpenCodeManager;

#[tokio::main]
async fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // Get app data directory and initialize database
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data directory");

            let db_path = app_data_dir.join("ai_command_center.db");

            println!("Initializing database at: {:?}", db_path);

            let database = db::Database::new(db_path).expect("Failed to initialize database");

            // Store database in app state for access from commands
            app.manage(Mutex::new(database));

            println!("Database initialized successfully");

            // Start OpenCode server and wait for it to be healthy
            let opencode_manager = tauri::async_runtime::block_on(async {
                OpenCodeManager::start().await
            })
            .expect("Failed to start OpenCode server");

            println!("OpenCode server started at: {}", opencode_manager.api_url());

            // Store OpenCode manager in app state
            app.manage(opencode_manager);

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
