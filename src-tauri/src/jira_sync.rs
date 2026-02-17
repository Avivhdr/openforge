//! JIRA Sync Service
//!
//! Background Tokio task that polls JIRA every N seconds, builds JQL queries based on config,
//! fetches tickets, upserts them to SQLite, and emits Tauri events to notify the frontend.
//!
//! ## Architecture
//! - Spawned as background task in main.rs setup hook
//! - Reads config from database (API token, board ID, filters, poll interval)
//! - Builds JQL query based on filter settings
//! - Calls JiraClient::search_issues() to fetch tickets
//! - Upserts tickets to database via Database::upsert_ticket()
//! - Maps JIRA status to cockpit status
//! - Emits `jira-sync-complete` event to frontend
//! - Sleeps for poll_interval seconds, then loops
//!
//! ## Error Handling
//! - Logs errors and continues (doesn't crash the sync loop)
//! - Individual ticket errors don't stop the batch
//! - Network errors trigger retry on next cycle

use crate::db::Database;
use crate::jira_client::{JiraClient, JiraIssue};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};
use tokio::time::{sleep, Duration};

/// Start the JIRA sync background task
///
/// This function spawns a Tokio task that runs indefinitely, polling JIRA
/// at the configured interval and syncing tickets to the database.
///
/// # Arguments
/// * `app` - Tauri AppHandle for accessing managed state and emitting events
///
/// # Example
/// ```no_run
/// // In main.rs setup hook:
/// tauri::async_runtime::spawn(start_jira_sync(app.handle().clone()));
/// ```
pub async fn start_jira_sync(app: AppHandle) {
    let jira_client = JiraClient::new();

    loop {
        // Read config from database
        let db = app.state::<Mutex<Database>>();
        let config = match read_sync_config(&db) {
            Ok(cfg) => cfg,
            Err(e) => {
                eprintln!("[JIRA Sync] Failed to read config: {}", e);
                sleep(Duration::from_secs(60)).await; // Default fallback
                continue;
            }
        };

        // Skip sync if required config is missing
        if config.jira_api_token.is_empty()
            || config.jira_username.is_empty()
            || config.jira_base_url.is_empty()
        {
            eprintln!("[JIRA Sync] Missing required config (jira_api_token, jira_username, or jira_base_url). Skipping sync.");
            sleep(Duration::from_secs(config.poll_interval)).await;
            continue;
        }

        // Build JQL query
        let jql = build_jql_query(&config);
        println!("[JIRA Sync] Polling JIRA with JQL: {}", jql);

        // Fetch tickets from JIRA
        match jira_client
            .search_issues(
                &config.jira_base_url,
                &config.jira_username,
                &config.jira_api_token,
                &jql,
            )
            .await
        {
            Ok(issues) => {
                println!("[JIRA Sync] Fetched {} issues", issues.len());

                // Upsert each ticket to database
                let mut success_count = 0;
                let mut error_count = 0;

                for issue in issues {
                    match upsert_ticket_from_jira(&db, &issue) {
                        Ok(_) => success_count += 1,
                        Err(e) => {
                            eprintln!(
                                "[JIRA Sync] Failed to upsert ticket {}: {}",
                                issue.key, e
                            );
                            error_count += 1;
                        }
                    }
                }

                println!(
                    "[JIRA Sync] Upserted {} tickets ({} errors)",
                    success_count, error_count
                );

                // Emit event to notify frontend
                if let Err(e) = app.emit("jira-sync-complete", ()) {
                    eprintln!("[JIRA Sync] Failed to emit event: {}", e);
                }
            }
            Err(e) => {
                eprintln!("[JIRA Sync] Failed to fetch issues: {}", e);
            }
        }

        // Sleep for poll interval
        sleep(Duration::from_secs(config.poll_interval)).await;
    }
}

/// Configuration for JIRA sync
#[derive(Debug)]
struct SyncConfig {
    jira_api_token: String,
    jira_base_url: String,
    jira_board_id: String,
    jira_username: String,
    filter_assigned_to_me: bool,
    exclude_done_tickets: bool,
    custom_jql: String,
    poll_interval: u64,
}

/// Read sync configuration from database
fn read_sync_config(db: &Mutex<Database>) -> Result<SyncConfig, String> {
    let db = db.lock().unwrap();

    let jira_api_token = db
        .get_config("jira_api_token")
        .map_err(|e| e.to_string())?
        .unwrap_or_default();

    let jira_base_url = db
        .get_config("jira_base_url")
        .map_err(|e| e.to_string())?
        .unwrap_or_default();

    let jira_board_id = db
        .get_config("jira_board_id")
        .map_err(|e| e.to_string())?
        .unwrap_or_default();

    let jira_username = db
        .get_config("jira_username")
        .map_err(|e| e.to_string())?
        .unwrap_or_default();

    let filter_assigned_to_me = db
        .get_config("filter_assigned_to_me")
        .map_err(|e| e.to_string())?
        .unwrap_or_else(|| "true".to_string())
        == "true";

    let exclude_done_tickets = db
        .get_config("exclude_done_tickets")
        .map_err(|e| e.to_string())?
        .unwrap_or_else(|| "true".to_string())
        == "true";

    let custom_jql = db
        .get_config("custom_jql")
        .map_err(|e| e.to_string())?
        .unwrap_or_default();

    let poll_interval = db
        .get_config("jira_poll_interval")
        .map_err(|e| e.to_string())?
        .unwrap_or_else(|| "60".to_string())
        .parse::<u64>()
        .unwrap_or(60);

    Ok(SyncConfig {
        jira_api_token,
        jira_base_url,
        jira_board_id,
        jira_username,
        filter_assigned_to_me,
        exclude_done_tickets,
        custom_jql,
        poll_interval,
    })
}

/// Build JQL query based on config filters
///
/// Combines multiple filters with AND:
/// - filter_assigned_to_me → `assignee = currentUser()`
/// - jira_board_id → `project = {board_id}`
/// - exclude_done_tickets → `status != Done`
/// - custom_jql → appended as-is
fn build_jql_query(config: &SyncConfig) -> String {
    let mut conditions = Vec::new();

    // Filter by assignee
    if config.filter_assigned_to_me {
        conditions.push("assignee = currentUser()".to_string());
    }

    // Filter by project/board
    if !config.jira_board_id.is_empty() {
        conditions.push(format!("project = {}", config.jira_board_id));
    }

    // Exclude done tickets
    if config.exclude_done_tickets {
        conditions.push("status != Done".to_string());
    }

    // Append custom JQL
    if !config.custom_jql.is_empty() {
        conditions.push(config.custom_jql.clone());
    }

    // Join with AND
    if conditions.is_empty() {
        // No filters, return all tickets (not recommended but valid)
        "ORDER BY updated DESC".to_string()
    } else {
        format!("{} ORDER BY updated DESC", conditions.join(" AND "))
    }
}

/// Map JIRA status to cockpit status
///
/// Mapping:
/// - "To Do" → "todo"
/// - "In Progress" → "in_progress"
/// - "In Review" | "Code Review" → "in_review"
/// - "Testing" | "QA" → "testing"
/// - "Done" | "Closed" → "done"
/// - _ → "todo" (default)
fn map_jira_status_to_cockpit(jira_status: &str) -> &'static str {
    match jira_status {
        "To Do" => "todo",
        "In Progress" => "in_progress",
        "In Review" | "Code Review" => "in_review",
        "Testing" | "QA" => "testing",
        "Done" | "Closed" => "done",
        _ => "todo", // Default fallback
    }
}

/// Upsert a ticket from JIRA issue to database
fn upsert_ticket_from_jira(db: &Mutex<Database>, issue: &JiraIssue) -> Result<(), String> {
    let db = db.lock().unwrap();

    // Extract fields
    let id = issue.key.clone();
    let title = issue.fields.summary.clone();
    let description = issue
        .fields
        .description
        .as_ref()
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let jira_status = issue.fields.status.as_ref().map(|s| s.name.clone()).unwrap_or_default();
    let status = map_jira_status_to_cockpit(&jira_status);
    let assignee = issue
        .fields
        .assignee
        .as_ref()
        .map(|u| u.display_name.clone())
        .unwrap_or_default();

    // Use current timestamp for both created_at and updated_at
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;

    // Upsert ticket
    db.upsert_ticket(
        &id,
        &title,
        &description,
        status,
        &jira_status,
        &assignee,
        now,
        now,
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_jql_query_all_filters() {
        let config = SyncConfig {
            jira_api_token: "token".to_string(),
            jira_base_url: "https://example.atlassian.net".to_string(),
            jira_board_id: "PROJ".to_string(),
            jira_username: "user@example.com".to_string(),
            filter_assigned_to_me: true,
            exclude_done_tickets: true,
            custom_jql: "priority = High".to_string(),
            poll_interval: 60,
        };

        let jql = build_jql_query(&config);
        assert!(jql.contains("assignee = currentUser()"));
        assert!(jql.contains("project = PROJ"));
        assert!(jql.contains("status != Done"));
        assert!(jql.contains("priority = High"));
        assert!(jql.contains("AND"));
    }

    #[test]
    fn test_build_jql_query_no_filters() {
        let config = SyncConfig {
            jira_api_token: "token".to_string(),
            jira_base_url: "https://example.atlassian.net".to_string(),
            jira_board_id: "".to_string(),
            jira_username: "user@example.com".to_string(),
            filter_assigned_to_me: false,
            exclude_done_tickets: false,
            custom_jql: "".to_string(),
            poll_interval: 60,
        };

        let jql = build_jql_query(&config);
        assert_eq!(jql, "ORDER BY updated DESC");
    }

    #[test]
    fn test_map_jira_status_to_cockpit() {
        assert_eq!(map_jira_status_to_cockpit("To Do"), "todo");
        assert_eq!(map_jira_status_to_cockpit("In Progress"), "in_progress");
        assert_eq!(map_jira_status_to_cockpit("In Review"), "in_review");
        assert_eq!(map_jira_status_to_cockpit("Code Review"), "in_review");
        assert_eq!(map_jira_status_to_cockpit("Testing"), "testing");
        assert_eq!(map_jira_status_to_cockpit("QA"), "testing");
        assert_eq!(map_jira_status_to_cockpit("Done"), "done");
        assert_eq!(map_jira_status_to_cockpit("Closed"), "done");
        assert_eq!(map_jira_status_to_cockpit("Unknown Status"), "todo");
    }
}
