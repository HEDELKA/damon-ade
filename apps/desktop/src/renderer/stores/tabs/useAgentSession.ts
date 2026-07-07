import type { AgentRuntime, TerminalPreset } from "@superset/local-db";
import {
	AGENT_LABELS,
	AGENT_PRESET_COMMANDS,
} from "@superset/shared/agent-command";
import { useCallback } from "react";
import { electronTrpc } from "renderer/lib/electron-trpc";
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
 * Spawns an agent's runtime CLI in a new terminal session tab.
 *
 * A "session" is just a normal terminal tab. Given an agent (workspace) with a
 * runtime, we build a synthetic TerminalPreset that launches the runtime's CLI
 * (via the user's terminal presets when one is named after the runtime,
 * falling back to AGENT_PRESET_COMMANDS) in the agent's worktree and open it
 * as a new tab. Claude session-id pinning for resume-after-reboot happens
 * downstream in launchCommandInPane — the choke point every preset launch
 * flows through. When the agent has no runtime we fall back to a plain shell.
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

			const preset: TerminalPreset = {
				id: `agent-${runtime}`,
				name: AGENT_LABELS[runtime] ?? runtime,
				cwd: worktreePath ?? "",
				commands: resolveRuntimeCommands(runtime, terminalPresets),
				executionMode: "new-tab",
			};

			return openPreset(id, preset, { target: "new-tab" });
		},
		[openPreset, addTab, terminalPresets],
	);

	return { spawnAgentSession };
}
