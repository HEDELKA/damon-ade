import { Badge } from "@superset/ui/badge";
import { Button } from "@superset/ui/button";
import { Checkbox } from "@superset/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@superset/ui/dialog";
import { Input } from "@superset/ui/input";
import { toast } from "@superset/ui/sonner";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@superset/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@superset/ui/tooltip";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
	type ElectronRouterOutputs,
	electronTrpc,
} from "renderer/lib/electron-trpc";

type ScannedProject = ElectronRouterOutputs["importer"]["scan"][number];

type RowStatus = "pending" | "importing" | "done" | "error";

interface RowState {
	status: RowStatus;
	/** Error message when status is "error". */
	message?: string;
	/** Destination path when status is "done". */
	destPath?: string;
}

const SIZE_UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

/** Human-readable byte size using binary units. */
function formatSize(bytes: number): string {
	if (bytes <= 0) return "0 B";
	const exp = Math.min(
		Math.floor(Math.log(bytes) / Math.log(1024)),
		SIZE_UNITS.length - 1,
	);
	const value = bytes / 1024 ** exp;
	return `${value.toFixed(exp === 0 ? 0 : 1)} ${SIZE_UNITS[exp]}`;
}

interface ImportProjectsDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

/**
 * Bulk importer UI: pick a folder, scan it for candidate projects, then import
 * the selected ones one by one via importer.importOne. The backend does the
 * copy / git init / GitHub push / trash; this dialog only drives it and shows
 * per-row status. Imported projects are not auto-registered as ADE teams.
 */
export function ImportProjectsDialog({
	open,
	onOpenChange,
}: ImportProjectsDialogProps) {
	const { t } = useTranslation();
	const utils = electronTrpc.useUtils();
	const selectDirectory = electronTrpc.window.selectDirectory.useMutation();
	const importOne = electronTrpc.importer.importOne.useMutation();

	const [dir, setDir] = useState("");
	const [projects, setProjects] = useState<ScannedProject[] | null>(null);
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [rowStates, setRowStates] = useState<Record<string, RowState>>({});
	const [makePrivateRepo, setMakePrivateRepo] = useState(true);
	const [trashSource, setTrashSource] = useState(false);
	const [isScanning, setIsScanning] = useState(false);
	const [isRunning, setIsRunning] = useState(false);

	const isBusy = isScanning || isRunning;

	const handleOpenChange = (next: boolean) => {
		// Only allow closing while idle so an in-flight import isn't abandoned.
		if (isRunning) return;
		onOpenChange(next);
	};

	const handleBrowse = async () => {
		const result = await selectDirectory.mutateAsync({
			title: t("importer.browseDialogTitle"),
			defaultPath: dir.trim() || undefined,
		});
		if (!result.canceled && result.path) {
			setDir(result.path);
		}
	};

	const handleScan = async () => {
		const target = dir.trim();
		if (!target) return;
		setIsScanning(true);
		try {
			const result = await utils.importer.scan.fetch({ dir: target });
			setProjects(result);
			setSelected(new Set(result.map((project) => project.path)));
			setRowStates({});
		} catch (error) {
			toast.error(error instanceof Error ? error.message : String(error));
		} finally {
			setIsScanning(false);
		}
	};

	const toggleRow = (path: string, checked: boolean) => {
		setSelected((prev) => {
			const next = new Set(prev);
			if (checked) {
				next.add(path);
			} else {
				next.delete(path);
			}
			return next;
		});
	};

	const handleImport = async () => {
		const targets = (projects ?? []).filter((project) =>
			selected.has(project.path),
		);
		if (targets.length === 0) {
			toast.error(t("importer.noSelection"));
			return;
		}

		setIsRunning(true);
		setRowStates((prev) => {
			const next = { ...prev };
			for (const project of targets) {
				next[project.path] = { status: "pending" };
			}
			return next;
		});

		let done = 0;
		let failed = 0;
		for (const project of targets) {
			setRowStates((prev) => ({
				...prev,
				[project.path]: { status: "importing" },
			}));
			try {
				const result = await importOne.mutateAsync({
					sourcePath: project.path,
					makePrivateRepo,
					trashSource,
				});
				done++;
				setRowStates((prev) => ({
					...prev,
					[project.path]: { status: "done", destPath: result.destPath },
				}));
			} catch (error) {
				failed++;
				setRowStates((prev) => ({
					...prev,
					[project.path]: {
						status: "error",
						message: error instanceof Error ? error.message : String(error),
					},
				}));
			}
		}

		setIsRunning(false);
		toast(t("importer.summary", { done, failed }));
	};

	const selectedCount = selected.size;

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="sm:max-w-[720px]">
				<DialogHeader>
					<DialogTitle>{t("importer.title")}</DialogTitle>
					<DialogDescription>{t("importer.description")}</DialogDescription>
				</DialogHeader>

				<div className="flex items-center gap-2">
					<Input
						value={dir}
						onChange={(event) => setDir(event.target.value)}
						placeholder={t("importer.folderPlaceholder")}
						disabled={isBusy}
						className="flex-1"
					/>
					<Button
						variant="outline"
						onClick={handleBrowse}
						disabled={isBusy || selectDirectory.isPending}
					>
						{t("importer.browse")}
					</Button>
					<Button
						onClick={handleScan}
						disabled={isBusy || dir.trim().length === 0}
					>
						{isScanning ? t("importer.scanning") : t("importer.scan")}
					</Button>
				</div>

				{projects !== null && projects.length === 0 && (
					<p className="text-sm text-muted-foreground py-6 text-center">
						{t("importer.empty")}
					</p>
				)}

				{projects === null && (
					<p className="text-sm text-muted-foreground py-6 text-center">
						{t("importer.scanHint")}
					</p>
				)}

				{projects !== null && projects.length > 0 && (
					<>
						<div className="max-h-[340px] overflow-y-auto rounded-md border">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead className="w-8" />
										<TableHead>{t("importer.columns.project")}</TableHead>
										<TableHead>{t("importer.columns.type")}</TableHead>
										<TableHead>{t("importer.columns.git")}</TableHead>
										<TableHead className="text-right">
											{t("importer.columns.size")}
										</TableHead>
										<TableHead>{t("importer.columns.status")}</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{projects.map((project) => (
										<ProjectRow
											key={project.path}
											project={project}
											checked={selected.has(project.path)}
											state={rowStates[project.path]}
											disabled={isRunning}
											onToggle={toggleRow}
										/>
									))}
								</TableBody>
							</Table>
						</div>

						<p className="text-xs text-muted-foreground">
							{t("importer.dropHint")}
						</p>

						<div className="flex flex-col gap-2">
							<label
								htmlFor="importer-private-repos"
								className="flex items-center gap-2 text-sm"
							>
								<Checkbox
									id="importer-private-repos"
									checked={makePrivateRepo}
									onCheckedChange={(value) =>
										setMakePrivateRepo(value === true)
									}
									disabled={isRunning}
								/>
								{t("importer.options.privateRepos")}
							</label>
							<label
								htmlFor="importer-trash-source"
								className="flex items-center gap-2 text-sm"
							>
								<Checkbox
									id="importer-trash-source"
									checked={trashSource}
									onCheckedChange={(value) => setTrashSource(value === true)}
									disabled={isRunning}
								/>
								<span>
									{t("importer.options.trashSource")}
									<span className="block text-xs text-muted-foreground">
										{t("importer.options.trashHint")}
									</span>
								</span>
							</label>
						</div>
					</>
				)}

				<DialogFooter>
					<Button
						variant="ghost"
						onClick={() => handleOpenChange(false)}
						disabled={isRunning}
					>
						{t("common.close")}
					</Button>
					<Button
						onClick={handleImport}
						disabled={isBusy || selectedCount === 0}
					>
						{isRunning
							? t("importer.importing")
							: t("importer.importSelectedCount", { count: selectedCount })}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

interface ProjectRowProps {
	project: ScannedProject;
	checked: boolean;
	state?: RowState;
	disabled: boolean;
	onToggle: (path: string, checked: boolean) => void;
}

function ProjectRow({
	project,
	checked,
	state,
	disabled,
	onToggle,
}: ProjectRowProps) {
	const { t } = useTranslation();

	const gitLabel = !project.hasGit
		? t("importer.git.none")
		: project.hasRemote
			? t("importer.git.remote")
			: t("importer.git.repo");

	return (
		<TableRow>
			<TableCell>
				<Checkbox
					checked={checked}
					onCheckedChange={(value) => onToggle(project.path, value === true)}
					disabled={disabled}
				/>
			</TableCell>
			<TableCell className="font-medium">
				{project.readmeExcerpt ? (
					<Tooltip delayDuration={300}>
						<TooltipTrigger asChild>
							<span className="cursor-help underline decoration-dotted underline-offset-2">
								{project.name}
							</span>
						</TooltipTrigger>
						<TooltipContent side="right" className="max-w-sm">
							<pre className="whitespace-pre-wrap text-xs">
								{project.readmeExcerpt}
							</pre>
						</TooltipContent>
					</Tooltip>
				) : (
					project.name
				)}
			</TableCell>
			<TableCell>
				<Badge variant="secondary">{project.kind}</Badge>
			</TableCell>
			<TableCell className="text-muted-foreground text-xs">
				{gitLabel}
			</TableCell>
			<TableCell className="text-right text-muted-foreground text-xs">
				{formatSize(project.sizeBytes)}
			</TableCell>
			<TableCell>
				<StatusCell state={state} />
			</TableCell>
		</TableRow>
	);
}

function StatusCell({ state }: { state?: RowState }) {
	const { t } = useTranslation();
	if (!state) return null;

	if (state.status === "error") {
		return (
			<Tooltip delayDuration={200}>
				<TooltipTrigger asChild>
					<span className="text-xs text-destructive cursor-help">
						{t("importer.statuses.error")}
					</span>
				</TooltipTrigger>
				<TooltipContent side="left" className="max-w-sm">
					<p className="text-xs">{state.message}</p>
				</TooltipContent>
			</Tooltip>
		);
	}

	if (state.status === "done") {
		return (
			<Tooltip delayDuration={200}>
				<TooltipTrigger asChild>
					<span className="text-xs text-muted-foreground cursor-help">
						{t("importer.statuses.done")}
					</span>
				</TooltipTrigger>
				<TooltipContent side="left" className="max-w-sm">
					<p className="text-xs font-mono break-all">{state.destPath}</p>
				</TooltipContent>
			</Tooltip>
		);
	}

	return (
		<span className="text-xs text-muted-foreground">
			{t(`importer.statuses.${state.status}`)}
		</span>
	);
}
