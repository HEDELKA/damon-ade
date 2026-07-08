import { execFile } from "node:child_process";
import {
	access,
	copyFile,
	mkdir,
	readdir,
	readFile,
	readlink,
	stat,
	symlink,
	writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { findRealBinary } from "main/lib/agent-setup/utils";
import { LIBRARY_DIRS, type ProjectKind } from "./scan";

const execFileAsync = promisify(execFile);

const CLAUDE_TIMEOUT_MS = 60_000;
const GIT_TIMEOUT_MS = 120_000;
/** gh push can be slow on a first upload; give it room but still bound it. */
const GH_TIMEOUT_MS = 300_000;

/** Steps emitted through onProgress so a caller can surface live status. */
export type ImportStep =
	| "copy"
	| "git-init"
	| "gh-create"
	| "describe"
	| "trash"
	| "done";

export interface ImportProgress {
	step: ImportStep;
	detail?: string;
}

export interface ImportProjectParams {
	/** Absolute path to the source project directory. */
	sourcePath: string;
	/** Absolute directory the copy is placed under (as <destBaseDir>/<name>). */
	destBaseDir: string;
	/** Create a private GitHub repo via gh and push when there is no origin. */
	makePrivateRepo: boolean;
	/** Move the source to trash after a fully successful import. */
	trashSource: boolean;
	onProgress?: (progress: ImportProgress) => void;
}

export type DescriptionSource = "ai" | "heuristic";

export interface ImportResult {
	name: string;
	/** Repo-safe name derived from the folder name (for gh repo create). */
	sanitizedName: string;
	destPath: string;
	kind: ProjectKind;
	description: string;
	descriptionSource: DescriptionSource;
	/** True when a git repo existed already or we ran `git init`. */
	gitInitialized: boolean;
	pushed: boolean;
	/** Why a push did not happen (e.g. "gh-not-ready", "not-requested"). */
	pushSkipped?: string;
	repoUrl: string | null;
	trashed: boolean;
	trashSkipped?: string;
}

/**
 * Best-effort Cyrillic → Latin transliteration so repo names built from Russian
 * folder names stay readable rather than collapsing to dashes.
 */
const CYRILLIC_MAP: Record<string, string> = {
	а: "a",
	б: "b",
	в: "v",
	г: "g",
	д: "d",
	е: "e",
	ё: "e",
	ж: "zh",
	з: "z",
	и: "i",
	й: "y",
	к: "k",
	л: "l",
	м: "m",
	н: "n",
	о: "o",
	п: "p",
	р: "r",
	с: "s",
	т: "t",
	у: "u",
	ф: "f",
	х: "h",
	ц: "ts",
	ч: "ch",
	ш: "sh",
	щ: "sch",
	ъ: "",
	ы: "y",
	ь: "",
	э: "e",
	ю: "yu",
	я: "ya",
};

function transliterate(input: string): string {
	let out = "";
	for (const ch of input) {
		const lower = ch.toLowerCase();
		if (lower in CYRILLIC_MAP) {
			const mapped = CYRILLIC_MAP[lower];
			out += ch === lower ? mapped : mapped.toUpperCase();
		} else {
			out += ch;
		}
	}
	return out;
}

/** Produce a GitHub-safe repo name: only [a-zA-Z0-9-_.], no leading dots. */
export function sanitizeRepoName(name: string): string {
	const translit = transliterate(name);
	const replaced = translit.replace(/[^a-zA-Z0-9-_.]/g, "-");
	const collapsed = replaced.replace(/-+/g, "-");
	const trimmed = collapsed.replace(/^[-.]+|[-.]+$/g, "");
	return trimmed || "project";
}

async function pathExists(target: string): Promise<boolean> {
	try {
		await access(target);
		return true;
	} catch {
		return false;
	}
}

/**
 * Recursively copy `src` into `dest`, skipping LIBRARY_DIRS. Symlinks are
 * recreated as links (never followed), so a copy can never escape the tree.
 */
async function copyDirFiltered(src: string, dest: string): Promise<void> {
	await mkdir(dest, { recursive: true });
	const entries = await readdir(src, { withFileTypes: true });

	for (const entry of entries) {
		const srcPath = path.join(src, entry.name);
		const destPath = path.join(dest, entry.name);

		if (entry.isSymbolicLink()) {
			const linkTarget = await readlink(srcPath);
			await symlink(linkTarget, destPath).catch(() => {
				// A conflicting entry or unsupported link — skip rather than abort.
			});
			continue;
		}
		if (entry.isDirectory()) {
			if (LIBRARY_DIRS.has(entry.name)) continue;
			await copyDirFiltered(srcPath, destPath);
		} else if (entry.isFile()) {
			await copyFile(srcPath, destPath);
		}
	}
}

/** Sensible .gitignore bodies keyed by detected kind, covering LIBRARY_DIRS. */
const GITIGNORE_BASE = [".DS_Store", ".env", ".env.local", "*.log"];

const GITIGNORE_BY_KIND: Record<ProjectKind, string[]> = {
	node: [
		"node_modules/",
		"dist/",
		"build/",
		".next/",
		".nuxt/",
		".cache/",
		".turbo/",
	],
	python: [
		"__pycache__/",
		".venv/",
		"venv/",
		".pytest_cache/",
		"*.pyc",
		"dist/",
		"build/",
	],
	go: ["vendor/", "/bin/"],
	rust: ["target/"],
	web: ["node_modules/", "dist/", "build/", ".cache/"],
	other: [],
};

function buildGitignore(kind: ProjectKind): string {
	const lines = [...GITIGNORE_BASE, ...GITIGNORE_BY_KIND[kind]];
	return `${lines.join("\n")}\n`;
}

/** Resolve a binary via the login shell, falling back to the bare name. */
function resolveBinary(name: string): string {
	return findRealBinary(name) ?? name;
}

interface RunResult {
	stdout: string;
	stderr: string;
}

async function run(
	file: string,
	args: string[],
	cwd: string,
	timeout: number,
): Promise<RunResult> {
	const { stdout, stderr } = await execFileAsync(file, args, {
		cwd,
		timeout,
		maxBuffer: 10 * 1024 * 1024,
	});
	return { stdout: stdout.toString(), stderr: stderr.toString() };
}

/** True when gh is installed and authenticated. */
async function isGhReady(gh: string): Promise<boolean> {
	try {
		await run(gh, ["auth", "status"], os.homedir(), GIT_TIMEOUT_MS);
		return true;
	} catch {
		return false;
	}
}

async function ensureGitRepo(
	destPath: string,
	kind: ProjectKind,
	git: string,
): Promise<void> {
	await run(git, ["init", "-b", "main"], destPath, GIT_TIMEOUT_MS);

	if (!(await pathExists(path.join(destPath, ".gitignore")))) {
		await writeFile(path.join(destPath, ".gitignore"), buildGitignore(kind));
	}

	// A local identity keeps the initial commit working even when the machine
	// has no global git user configured.
	await run(git, ["add", "-A"], destPath, GIT_TIMEOUT_MS);
	await run(
		git,
		[
			"-c",
			"user.name=ADE Importer",
			"-c",
			"user.email=importer@ade.local",
			"commit",
			"-m",
			"chore: initial import from local folder",
		],
		destPath,
		GIT_TIMEOUT_MS,
	);
}

interface PushOutcome {
	pushed: boolean;
	pushSkipped?: string;
	repoUrl: string | null;
}

async function pushToGitHub(
	destPath: string,
	sanitizedName: string,
	hasRemote: boolean,
	git: string,
	gh: string,
): Promise<PushOutcome> {
	if (hasRemote) {
		// Respect an existing origin: just try to push, best-effort.
		try {
			await run(git, ["push"], destPath, GH_TIMEOUT_MS);
			return { pushed: true, repoUrl: null };
		} catch (error) {
			return {
				pushed: false,
				pushSkipped: error instanceof Error ? error.message : "push-failed",
				repoUrl: null,
			};
		}
	}

	if (!(await isGhReady(gh))) {
		return { pushed: false, pushSkipped: "gh-not-ready", repoUrl: null };
	}

	try {
		const { stdout } = await run(
			gh,
			[
				"repo",
				"create",
				sanitizedName,
				"--private",
				"--source",
				destPath,
				"--push",
			],
			destPath,
			GH_TIMEOUT_MS,
		);
		const urlMatch = stdout.match(/https:\/\/github\.com\/\S+/);
		return { pushed: true, repoUrl: urlMatch ? urlMatch[0] : null };
	} catch (error) {
		return {
			pushed: false,
			pushSkipped: error instanceof Error ? error.message : "gh-create-failed",
			repoUrl: null,
		};
	}
}

/** List up to two directory levels of file names to give the model context. */
async function listTopLevels(dir: string, maxEntries = 60): Promise<string[]> {
	const out: string[] = [];
	try {
		const top = await readdir(dir, { withFileTypes: true });
		for (const entry of top) {
			if (entry.name.startsWith(".") || LIBRARY_DIRS.has(entry.name)) continue;
			out.push(entry.name);
			if (out.length >= maxEntries) return out;
			if (entry.isDirectory()) {
				try {
					const sub = await readdir(path.join(dir, entry.name));
					for (const child of sub.slice(0, 10)) {
						out.push(`${entry.name}/${child}`);
						if (out.length >= maxEntries) return out;
					}
				} catch {
					// unreadable subdir — skip
				}
			}
		}
	} catch {
		// unreadable dir — return whatever we have
	}
	return out;
}

const KIND_LABELS: Record<ProjectKind, string> = {
	node: "Проект на Node.js",
	python: "Проект на Python",
	go: "Проект на Go",
	rust: "Проект на Rust",
	web: "Веб-проект (HTML/CSS/JS)",
	other: "Программный проект",
};

async function heuristicDescription(
	destPath: string,
	kind: ProjectKind,
): Promise<string> {
	if (kind === "node") {
		try {
			const pkgRaw = await readFile(
				path.join(destPath, "package.json"),
				"utf-8",
			);
			const pkg = JSON.parse(pkgRaw) as { description?: string };
			if (pkg.description?.trim()) {
				return `${KIND_LABELS.node}: ${pkg.description.trim()}`;
			}
		} catch {
			// no/invalid package.json — fall through to the label
		}
	}
	return `${KIND_LABELS[kind]}.`;
}

async function generateDescription(
	destPath: string,
	kind: ProjectKind,
	readmeExcerpt: string | null,
): Promise<{ description: string; source: DescriptionSource }> {
	const claude = findRealBinary("claude");
	if (!claude) {
		return {
			description: await heuristicDescription(destPath, kind),
			source: "heuristic",
		};
	}

	const fileList = (await listTopLevels(destPath)).join("\n");
	const prompt = [
		"Ниже описание проекта из локальной папки.",
		"Опиши в 1-2 предложениях по-русски, что это за проект.",
		"Ответь только описанием, без вводных фраз и форматирования.",
		"",
		`Тип проекта (по маркерам): ${kind}`,
		"",
		"README (начало):",
		readmeExcerpt ?? "(README отсутствует)",
		"",
		"Файлы (верхние уровни):",
		fileList || "(пусто)",
	].join("\n");

	try {
		const { stdout } = await run(
			claude,
			["-p", prompt, "--output-format", "text"],
			destPath,
			CLAUDE_TIMEOUT_MS,
		);
		const text = stdout.trim();
		if (text) {
			return { description: text, source: "ai" };
		}
	} catch {
		// CLI missing, timed out, or errored — fall back below.
	}
	return {
		description: await heuristicDescription(destPath, kind),
		source: "heuristic",
	};
}

interface TrashOutcome {
	trashed: boolean;
	trashSkipped?: string;
}

/**
 * Move `target` to trash. Prefers `gio trash`, falls back to `trash-put`.
 * Never uses rm -rf — a failed trash is reported, not escalated to deletion.
 */
async function trashPath(target: string): Promise<TrashOutcome> {
	const gio = findRealBinary("gio");
	if (gio) {
		try {
			await run(gio, ["trash", target], os.homedir(), GIT_TIMEOUT_MS);
			return { trashed: true };
		} catch (error) {
			return {
				trashed: false,
				trashSkipped: error instanceof Error ? error.message : "gio-failed",
			};
		}
	}

	const trashPut = findRealBinary("trash-put");
	if (trashPut) {
		try {
			await run(trashPut, [target], os.homedir(), GIT_TIMEOUT_MS);
			return { trashed: true };
		} catch (error) {
			return {
				trashed: false,
				trashSkipped:
					error instanceof Error ? error.message : "trash-put-failed",
			};
		}
	}

	return { trashed: false, trashSkipped: "no-trash-tool" };
}

async function assertSourceDir(sourcePath: string): Promise<void> {
	if (!path.isAbsolute(sourcePath)) {
		throw new Error(`Source path must be absolute: ${sourcePath}`);
	}
	let s: Awaited<ReturnType<typeof stat>>;
	try {
		s = await stat(sourcePath);
	} catch {
		throw new Error(`Source path does not exist: ${sourcePath}`);
	}
	if (!s.isDirectory()) {
		throw new Error(`Source path is not a directory: ${sourcePath}`);
	}
}

/**
 * Import a single local project: copy (minus library dirs), ensure a git repo,
 * optionally create+push a private GitHub repo, generate a Russian AI
 * description, and optionally trash the source. Registration into ADE
 * teams/agents is intentionally NOT done here — the caller receives the result
 * and performs registration (see importer router docs).
 */
export async function importProject(
	params: ImportProjectParams,
): Promise<ImportResult> {
	const { sourcePath, destBaseDir, makePrivateRepo, trashSource, onProgress } =
		params;

	await assertSourceDir(sourcePath);
	if (!path.isAbsolute(destBaseDir)) {
		throw new Error(`Destination base dir must be absolute: ${destBaseDir}`);
	}

	const name = path.basename(sourcePath);
	const sanitizedName = sanitizeRepoName(name);
	const destPath = path.join(destBaseDir, name);

	if (await pathExists(destPath)) {
		throw new Error(`Destination already exists: ${destPath}`);
	}

	const git = resolveBinary("git");
	const gh = resolveBinary("gh");

	// Detect existing git state on the SOURCE before copying.
	const hadGit = await pathExists(path.join(sourcePath, ".git"));
	let hasRemote = false;
	if (hadGit) {
		try {
			const config = await readFile(
				path.join(sourcePath, ".git", "config"),
				"utf-8",
			);
			hasRemote = /\[remote "origin"\]/.test(config);
		} catch {
			hasRemote = false;
		}
	}

	const readmeExcerpt = await readReadme(sourcePath);

	// a. Copy
	onProgress?.({ step: "copy", detail: destPath });
	await mkdir(destBaseDir, { recursive: true });
	await copyDirFiltered(sourcePath, destPath);

	// b. Ensure a git repo
	onProgress?.({ step: "git-init" });
	if (!hadGit) {
		await ensureGitRepo(destPath, await detectKindAt(destPath), git);
	}
	const gitInitialized = true;

	// c. GitHub push
	let push: PushOutcome = {
		pushed: false,
		pushSkipped: "not-requested",
		repoUrl: null,
	};
	if (makePrivateRepo || hasRemote) {
		onProgress?.({ step: "gh-create" });
		push = await pushToGitHub(destPath, sanitizedName, hasRemote, git, gh);
	}

	// d. AI description (Russian)
	onProgress?.({ step: "describe" });
	const kind = await detectKindAt(destPath);
	const { description, source } = await generateDescription(
		destPath,
		kind,
		readmeExcerpt,
	);

	// f. Trash the source (only after everything above succeeded)
	let trash: TrashOutcome = { trashed: false };
	if (trashSource) {
		onProgress?.({ step: "trash" });
		trash = await trashPath(sourcePath);
	}

	onProgress?.({ step: "done" });

	return {
		name,
		sanitizedName,
		destPath,
		kind,
		description,
		descriptionSource: source,
		gitInitialized,
		pushed: push.pushed,
		pushSkipped: push.pushSkipped,
		repoUrl: push.repoUrl,
		trashed: trash.trashed,
		trashSkipped: trash.trashSkipped,
	};
}

/** Read the first ~40 lines of a README* file if present. */
async function readReadme(dir: string): Promise<string | null> {
	try {
		const entries = await readdir(dir);
		const readmeName = entries.find((entry) =>
			entry.toLowerCase().startsWith("readme"),
		);
		if (!readmeName) return null;
		const content = await readFile(path.join(dir, readmeName), "utf-8");
		return content.split(/\r?\n/).slice(0, 40).join("\n");
	} catch {
		return null;
	}
}

/** Detect project kind at a path (mirrors scan.ts, kept local to avoid a dep cycle). */
async function detectKindAt(dir: string): Promise<ProjectKind> {
	if (await pathExists(path.join(dir, "package.json"))) return "node";
	if (
		(await pathExists(path.join(dir, "pyproject.toml"))) ||
		(await pathExists(path.join(dir, "requirements.txt")))
	) {
		return "python";
	}
	if (await pathExists(path.join(dir, "go.mod"))) return "go";
	if (await pathExists(path.join(dir, "Cargo.toml"))) return "rust";
	if (await pathExists(path.join(dir, "index.html"))) return "web";
	return "other";
}
