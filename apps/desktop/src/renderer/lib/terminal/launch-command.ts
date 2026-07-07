import {
	commandLaunchesClaude,
	insertClaudeArgs,
} from "@superset/shared/agent-command";
import { electronTrpcClient as trpcClient } from "renderer/lib/trpc-client";

interface TerminalCreateOrAttachInput {
	paneId: string;
	tabId: string;
	workspaceId: string;
}

interface TerminalWriteInput {
	paneId: string;
	data: string;
	throwOnError?: boolean;
}

interface LaunchCommandInPaneOptions {
	paneId: string;
	tabId: string;
	workspaceId: string;
	command: string;
	createOrAttach: (input: TerminalCreateOrAttachInput) => Promise<unknown>;
	write: (input: TerminalWriteInput) => Promise<unknown>;
}

function normalizeTerminalCommand(command: string): string {
	return command.endsWith("\n") ? command : `${command}\n`;
}

interface WriteCommandInPaneOptions {
	paneId: string;
	command: string;
	write: (input: TerminalWriteInput) => Promise<unknown>;
}

interface WriteCommandsInPaneOptions {
	paneId: string;
	commands: string[] | null | undefined;
	write: (input: TerminalWriteInput) => Promise<unknown>;
}

export function buildTerminalCommand(
	commands: string[] | null | undefined,
): string | null {
	if (!Array.isArray(commands) || commands.length === 0) return null;
	return commands.join(" && ");
}

export async function writeCommandInPane({
	paneId,
	command,
	write,
}: WriteCommandInPaneOptions): Promise<void> {
	await write({
		paneId,
		data: normalizeTerminalCommand(command),
		throwOnError: true,
	});
}

export async function writeCommandsInPane({
	paneId,
	commands,
	write,
}: WriteCommandsInPaneOptions): Promise<void> {
	const command = buildTerminalCommand(commands);
	if (!command) return;
	await writeCommandInPane({ paneId, command, write });
}

/**
 * Pin a fresh Claude Code session id into any launch command that starts
 * `claude`, and record it (plus the un-pinned base command) in the pane's
 * terminal-history meta. This is the single choke point every preset launch
 * flows through — agent sessions, model bar, presets bar, auto-apply presets —
 * so every Claude session becomes resumable after a reboot or power loss,
 * even if the notify hook never reports the id.
 */
function pinClaudeSessionIntoCommand(
	paneId: string,
	workspaceId: string,
	command: string,
): string {
	if (!commandLaunchesClaude(command)) {
		// Not a Claude launch — still persist the command so cold restore can
		// re-run it after a reboot instead of leaving a bare shell.
		trpcClient.terminal.setPaneLaunchCommand
			.mutate({ paneId, workspaceId, launchCommand: command })
			.catch((error) => {
				console.warn(
					"[launch-command] Failed to record pane launch command:",
					error instanceof Error ? error.message : String(error),
				);
			});
		return command;
	}
	// Respect explicit session management in the user's own command.
	if (command.includes("--session-id") || command.includes("--resume")) {
		return command;
	}

	const sessionId = crypto.randomUUID();
	const pinned = insertClaudeArgs(command, `--session-id ${sessionId}`);
	if (!pinned) return command;

	trpcClient.terminal.setClaudeSessionId
		.mutate({
			paneId,
			workspaceId,
			claudeSessionId: sessionId,
			launchCommand: command,
		})
		.catch((error) => {
			console.warn(
				"[launch-command] Failed to record pinned Claude session id:",
				error instanceof Error ? error.message : String(error),
			);
		});

	return pinned;
}

export async function launchCommandInPane({
	paneId,
	tabId,
	workspaceId,
	command,
	createOrAttach,
	write,
}: LaunchCommandInPaneOptions): Promise<void> {
	await createOrAttach({
		paneId,
		tabId,
		workspaceId,
	});

	const effectiveCommand = pinClaudeSessionIntoCommand(
		paneId,
		workspaceId,
		command,
	);

	await writeCommandInPane({ paneId, command: effectiveCommand, write });
}
