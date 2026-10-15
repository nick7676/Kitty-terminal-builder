use std::process::Command;

use serde::Serialize;

use crate::util::explain;

#[derive(Serialize)]
pub struct CommandResult {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
}

pub fn command_output(mut command: Command) -> Result<CommandResult, String> {
    let output = command.output().map_err(explain)?;
    Ok(CommandResult {
        success: output.status.success(),
        stdout: String::from_utf8_lossy(&output.stdout).trim().to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).trim().to_string(),
    })
}
