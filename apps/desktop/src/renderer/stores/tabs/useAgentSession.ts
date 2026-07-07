import type { AgentRuntime, TerminalPreset } from "@superset/local-db";
import {
	AGENT_LABELS,
	AGENT_PRESET_COMMANDS,
	commandLaunchesClaude,
	insertClaudeArgs,
	isClaudeBasedAgent,
} from "@superset/shared/agent-command";
import { useCallback } from "react";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { electronTrpcClient as trpcClient } from "renderer/lib/trpc-client";
import { useTabsWithPresets } from "./useTabsWithPresets";

/** Minimal shape needed to spawn an agent's runtime CLI session. */
export interface AgentSessionWorkspace {
	id: string;
	runtime?: AgentRuntime | null;
	worktreePath?: string | null;
}

/**
 * Find the user-configured launch commands for a runtime: a terminal preset
 * whose name matches the runtime slug (the default presets are seeded this
 * way, and the user can edit them in Settings → Terminal).
 */
function resolveRuntimeCommands(
	runtime: AgentRuntime,
	presets: TerminalPreset[] | undefined,
): string[] {
	const userPreset = presets?.find(
		(p) => p.name.trim().toLowerCase() === runtime && p.commands.length > 0,
	);
	return userPreset?.commands ?? AGENT_PRESET_COMMANDS[runtime];
}

/**
 * Pin a fresh Claude Code session id into the launch command so the session
 * can always be resumed later (`claude --resume <id>`), even if the power
 * goes out before the notify hook reports the id. Only applies when exactly
 * one command launches `claude` — pinning the same id twice would collide.
 */
function pinClaudeSessionId(
	commands: string[],
	sessionId: string,
): { commands: string[]; pinned: boolean } {
	const claudeCommandCount = commands.filter(commandLaunchesClaude).length;
	if (claudeCommandCount !== 1) return { commands, pinned: false };

	const pinnedCommands = commands.map(
		(command) =>
			insertClaudeArgs(command, `--session-id ${sessionId}`) ?? command,
	);
	return { commands: pinnedCommands, pinned: true };
}

/**
 * Spawns an agent's runtime CLI in a new terminal session tab.
 *
 * A "session" is just a normal terminal tab. Given an agent (workspace) with a
 * runtime, we build a synthetic TerminalPreset that launches the runtime's CLI
 * in the agent's worktree and open it as a new tab. Launch commands come from
 * the user's terminal presets (Settings → Terminal) when a preset named after
 * the runtime exists, falling back to the stock AGENT_PRESET_COMMANDS.
 * When the agent has no runtime we fall back to a plain shell tab.
 */
export function useAgentSession() {
	const { openPreset, addTab } = useTabsWithPresets();
	const { data: terminalPresets } =
		electronTrpc.settings.getTerminalPresets.useQuery();

	const spawnAgentSession = useCallback(
		(workspace: AgentSessionWorkspace) => {
			const { id, runtime, worktreePath } = workspace;
			const cwd = worktreePath || undefined;

			if (!runtime) {
				// No runtime configured — open a plain shell in the worktree.
				return addTab(id, { initialCwd: cwd });
			}

			const baseCommands = resolveRuntimeCommands(runtime, terminalPresets);
			let commands = baseCommands;
			let pinnedSessionId: string | null = null;

			if (isClaudeBasedAgent(runtime)) {
				const sessionId = crypto.randomUUID();
				const result = pinClaudeSessionId(baseCommands, sessionId);
				commands = result.commands;
				if (result.pinned) pinnedSessionId = sessionId;
			}

			const preset: TerminalPreset = {
				id: `agent-${runtime}`,
				name: AGENT_LABELS[runtime] ?? runtime,
				cwd: worktreePath ?? "",
				commands,
				executionMode: "new-tab",
			};

			const opened = openPreset(id, preset, { target: "new-tab" });

			if (pinnedSessionId && opened?.paneId) {
				// Record the pinned id and the un-pinned launch command so cold
				// restore can rebuild `claude --resume` with the same flags/env.
				trpcClient.terminal.setClaudeSessionId
					.mutate({
						paneId: opened.paneId,
						workspaceId: id,
						claudeSessionId: pinnedSessionId,
						claudeLaunchCommand: baseCommands.find(commandLaunchesClaude),
					})
					.catch((error) => {
						console.warn(
							"[useAgentSession] Failed to record pinned Claude session id:",
							error instanceof Error ? error.message : String(error),
						);
					});
			}

			return opened;
		},
		[openPreset, addTab, terminalPresets],
	);

	return { spawnAgentSession };
}
