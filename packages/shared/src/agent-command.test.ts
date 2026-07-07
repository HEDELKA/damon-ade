import { describe, expect, it } from "bun:test";
import {
	buildAgentPromptCommand,
	buildClaudeResumeCommand,
	commandLaunchesClaude,
	insertClaudeArgs,
	isClaudeBasedAgent,
} from "./agent-command";

describe("buildAgentPromptCommand", () => {
	it("adds `--` before codex prompt payload", () => {
		const command = buildAgentPromptCommand({
			prompt: "- Only modified file: runtime.ts",
			randomId: "1234-5678",
			agent: "codex",
		});

		expect(command).toContain(
			"--sandbox danger-full-access -- \"$(cat <<'SUPERSET_PROMPT_12345678'",
		);
		expect(command).toContain("- Only modified file: runtime.ts");
	});

	it("does not change non-codex commands", () => {
		const command = buildAgentPromptCommand({
			prompt: "hello",
			randomId: "abcd-efgh",
			agent: "claude",
		});

		expect(command).toStartWith(
			"claude --dangerously-skip-permissions \"$(cat <<'SUPERSET_PROMPT_abcdefgh'",
		);
	});
});

describe("commandLaunchesClaude", () => {
	it("matches a bare claude command", () => {
		expect(commandLaunchesClaude("claude")).toBe(true);
	});

	it("matches claude with flags", () => {
		expect(commandLaunchesClaude("claude --dangerously-skip-permissions")).toBe(
			true,
		);
	});

	it("matches claude behind env-var prefixes", () => {
		expect(
			commandLaunchesClaude(
				'ANTHROPIC_BASE_URL="https://openrouter.ai/api" claude --model x',
			),
		).toBe(true);
	});

	it("does not match other binaries", () => {
		expect(commandLaunchesClaude("codex --model gpt-5.5")).toBe(false);
		expect(commandLaunchesClaude("claudette --help")).toBe(false);
	});
});

describe("insertClaudeArgs", () => {
	it("inserts args right after the claude token", () => {
		expect(
			insertClaudeArgs("claude --dangerously-skip-permissions", "--resume abc"),
		).toBe("claude --resume abc --dangerously-skip-permissions");
	});

	it("preserves env-var prefixes", () => {
		expect(
			insertClaudeArgs('FOO="bar" claude --model m', "--session-id 123"),
		).toBe('FOO="bar" claude --session-id 123 --model m');
	});

	it("returns null for non-claude commands", () => {
		expect(insertClaudeArgs("opencode", "--resume abc")).toBeNull();
	});
});

describe("buildClaudeResumeCommand", () => {
	it("derives flags from the configured launch command", () => {
		expect(
			buildClaudeResumeCommand("claude --dangerously-skip-permissions", "sid"),
		).toBe("claude --resume sid --dangerously-skip-permissions");
	});

	it("falls back to danger mode when no base command is configured", () => {
		expect(buildClaudeResumeCommand(null, "sid")).toBe(
			"claude --resume sid --dangerously-skip-permissions",
		);
	});

	it("falls back when the base command does not launch claude", () => {
		expect(buildClaudeResumeCommand("codex", "sid")).toBe(
			"claude --resume sid --dangerously-skip-permissions",
		);
	});
});

describe("isClaudeBasedAgent", () => {
	it("recognizes claude and OpenRouter-proxied runtimes", () => {
		expect(isClaudeBasedAgent("claude")).toBe(true);
		expect(isClaudeBasedAgent("kimi")).toBe(true);
		expect(isClaudeBasedAgent("minimax")).toBe(true);
		expect(isClaudeBasedAgent("glm")).toBe(true);
	});

	it("rejects non-claude runtimes", () => {
		expect(isClaudeBasedAgent("codex")).toBe(false);
		expect(isClaudeBasedAgent("opencode")).toBe(false);
	});
});
