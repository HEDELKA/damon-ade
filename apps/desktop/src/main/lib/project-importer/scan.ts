import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

/**
 * Directories that must never be copied and must be excluded from size
 * calculation. These are dependency / build / cache trees that any importer
 * would want to regenerate rather than carry along.
 */
export const LIBRARY_DIRS: ReadonlySet<string> = new Set([
	"node_modules",
	".venv",
	"venv",
	"__pycache__",
	".pytest_cache",
	"target",
	"dist",
	"build",
	".next",
	".nuxt",
	".cache",
	".turbo",
	"vendor",
	"Pods",
	".gradle",
]);

export type ProjectKind = "node" | "python" | "go" | "rust" | "web" | "other";

export interface ScannedProject {
	name: string;
	path: string;
	kind: ProjectKind;
	hasGit: boolean;
	hasRemote: boolean;
	/** Approximate on-disk size in bytes, excluding LIBRARY_DIRS and .git. */
	sizeBytes: number;
	/** First ~40 lines of a README* file if one exists, else null. */
	readmeExcerpt: string | null;
}

const README_EXCERPT_LINES = 40;
/** Cap the size walk so a pathological tree can't stall the scan. */
const MAX_SIZE_WALK_ENTRIES = 20_000;

async function pathExists(target: string): Promise<boolean> {
	try {
		await stat(target);
		return true;
	} catch {
		return false;
	}
}

async function detectKind(dir: string): Promise<ProjectKind> {
	// Order matters: a repo may carry several markers, so pick the most
	// specific language toolchain first and fall back to a generic web page.
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

/**
 * A repo has a configured origin remote when its .git/config carries a
 * `[remote "origin"]` section. We parse the file rather than shell out so the
 * scan stays cheap and side-effect free.
 */
async function hasOriginRemote(gitDir: string): Promise<boolean> {
	try {
		const config = await readFile(path.join(gitDir, "config"), "utf-8");
		return /\[remote "origin"\]/.test(config);
	} catch {
		return false;
	}
}

async function readReadmeExcerpt(dir: string): Promise<string | null> {
	let entries: string[];
	try {
		entries = await readdir(dir);
	} catch {
		return null;
	}
	const readmeName = entries.find((entry) =>
		entry.toLowerCase().startsWith("readme"),
	);
	if (!readmeName) return null;
	try {
		const content = await readFile(path.join(dir, readmeName), "utf-8");
		return content.split(/\r?\n/).slice(0, README_EXCERPT_LINES).join("\n");
	} catch {
		return null;
	}
}

/**
 * Recursively sum file sizes under `dir`, skipping LIBRARY_DIRS and .git and
 * never following symlinks (we stat with lstat semantics via withFileTypes).
 */
async function approxSize(dir: string): Promise<number> {
	let total = 0;
	let visited = 0;
	const stack: string[] = [dir];

	while (stack.length > 0) {
		const current = stack.pop();
		if (!current) break;
		let entries: Awaited<ReturnType<typeof readdir>>;
		try {
			entries = await readdir(current, { withFileTypes: true });
		} catch {
			continue;
		}
		for (const entry of entries) {
			if (visited >= MAX_SIZE_WALK_ENTRIES) return total;
			visited++;
			if (entry.isSymbolicLink()) continue;
			if (entry.isDirectory()) {
				if (entry.name === ".git" || LIBRARY_DIRS.has(entry.name)) continue;
				stack.push(path.join(current, entry.name));
			} else if (entry.isFile()) {
				try {
					total += (await stat(path.join(current, entry.name))).size;
				} catch {
					// unreadable file — ignore its contribution
				}
			}
		}
	}
	return total;
}

async function scanOne(
	parentDir: string,
	name: string,
): Promise<ScannedProject | null> {
	const projectPath = path.join(parentDir, name);

	let entries: Awaited<ReturnType<typeof readdir>>;
	try {
		entries = await readdir(projectPath, { withFileTypes: true });
	} catch {
		return null;
	}
	// Skip empty directories — nothing to import.
	if (entries.length === 0) return null;

	const gitDir = path.join(projectPath, ".git");
	const hasGit = await pathExists(gitDir);

	const [kind, hasRemote, sizeBytes, readmeExcerpt] = await Promise.all([
		detectKind(projectPath),
		hasGit ? hasOriginRemote(gitDir) : Promise.resolve(false),
		approxSize(projectPath),
		readReadmeExcerpt(projectPath),
	]);

	return {
		name,
		path: projectPath,
		kind,
		hasGit,
		hasRemote,
		sizeBytes,
		readmeExcerpt,
	};
}

/**
 * List the immediate subdirectories of `dir` and describe each as a candidate
 * project. Files, hidden directories, and empty directories are skipped.
 *
 * @throws if `dir` is not an absolute path to an existing directory.
 */
export async function scanProjectsDir(dir: string): Promise<ScannedProject[]> {
	if (!path.isAbsolute(dir)) {
		throw new Error(`Scan directory must be an absolute path: ${dir}`);
	}
	let dirStat: Awaited<ReturnType<typeof stat>>;
	try {
		dirStat = await stat(dir);
	} catch {
		throw new Error(`Scan directory does not exist: ${dir}`);
	}
	if (!dirStat.isDirectory()) {
		throw new Error(`Scan path is not a directory: ${dir}`);
	}

	const entries = await readdir(dir, { withFileTypes: true });
	const candidates = entries.filter(
		(entry) => entry.isDirectory() && !entry.name.startsWith("."),
	);

	const scanned = await Promise.all(
		candidates.map((entry) => scanOne(dir, entry.name)),
	);

	return scanned.filter(
		(project): project is ScannedProject => project !== null,
	);
}
