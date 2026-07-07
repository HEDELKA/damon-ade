import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@superset/ui/alert-dialog";
import { Button } from "@superset/ui/button";
import { Input } from "@superset/ui/input";
import { Kbd, KbdGroup } from "@superset/ui/kbd";
import { toast } from "@superset/ui/sonner";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiMagnifyingGlass } from "react-icons/hi2";
import { electronTrpc } from "renderer/lib/electron-trpc";
import {
	captureHotkeyFromEvent,
	getHotkeyConflict,
	useHotkeyDisplay,
	useHotkeysByCategory,
	useHotkeysStore,
} from "renderer/stores/hotkeys";
import {
	formatHotkeyText,
	HOTKEYS,
	type HotkeyCategory,
	type HotkeyId,
	type HotkeysState,
	isOsReservedHotkey,
	isTerminalReservedHotkey,
} from "shared/hotkeys";

const CATEGORY_ORDER: HotkeyCategory[] = [
	"Workspace",
	"Terminal",
	"Layout",
	"Window",
	"Help",
];

function HotkeyRow({
	id,
	label,
	description,
	isRecording,
	onStartRecording,
	onReset,
}: {
	id: HotkeyId;
	label: string;
	description?: string;
	isRecording: boolean;
	onStartRecording: () => void;
	onReset: () => void;
}) {
	const { t } = useTranslation();
	const display = useHotkeyDisplay(id);

	return (
		<div className="flex items-center justify-between gap-4 py-3 px-4">
			<div className="flex flex-col">
				<span className="text-sm text-foreground">{label}</span>
				{description && (
					<span className="text-xs text-muted-foreground">{description}</span>
				)}
			</div>
			<div className="flex items-center gap-2">
				<button
					type="button"
					onClick={onStartRecording}
					className="h-7 px-3 rounded-md border border-border bg-accent/20 text-xs text-foreground hover:bg-accent/40 transition-colors"
				>
					{isRecording ? (
						<span className="text-xs text-muted-foreground">
							{t("settings.keyboard.recording")}
						</span>
					) : (
						<KbdGroup>
							{display.map((key) => (
								<Kbd key={key}>{key}</Kbd>
							))}
						</KbdGroup>
					)}
				</button>
				<Button variant="ghost" size="sm" onClick={onReset}>
					{t("settings.keyboard.reset")}
				</Button>
			</div>
		</div>
	);
}

export const Route = createFileRoute("/_authenticated/settings/keyboard/")({
	component: KeyboardShortcutsPage,
});

function KeyboardShortcutsPage() {
	const { t } = useTranslation();
	const [searchQuery, setSearchQuery] = useState("");
	const [recordingId, setRecordingId] = useState<HotkeyId | null>(null);
	const [pendingConflict, setPendingConflict] = useState<{
		id: HotkeyId;
		keys: string;
		conflictId: HotkeyId;
	} | null>(null);
	const [pendingImport, setPendingImport] = useState<{
		path: string;
		state: HotkeysState;
		summary: { assigned: number; disabled: number };
	} | null>(null);

	const platform = useHotkeysStore((state) => state.platform);
	const setHotkey = useHotkeysStore((state) => state.setHotkey);
	const setHotkeysBatch = useHotkeysStore((state) => state.setHotkeysBatch);
	const resetHotkey = useHotkeysStore((state) => state.resetHotkey);
	const resetAllHotkeys = useHotkeysStore((state) => state.resetAllHotkeys);
	const replaceHotkeysState = useHotkeysStore(
		(state) => state.replaceHotkeysState,
	);
	const hotkeysByCategory = useHotkeysByCategory();

	const exportMutation = electronTrpc.hotkeys.export.useMutation();
	const importMutation = electronTrpc.hotkeys.import.useMutation();

	const showHotkeysDisplay = useHotkeyDisplay("SHOW_HOTKEYS");

	const filteredHotkeysByCategory = useMemo(() => {
		if (!searchQuery) return hotkeysByCategory;
		const lower = searchQuery.toLowerCase();
		return Object.fromEntries(
			CATEGORY_ORDER.map((category) => [
				category,
				(hotkeysByCategory[category] ?? []).filter((hotkey) =>
					hotkey.label.toLowerCase().includes(lower),
				),
			]),
		) as typeof hotkeysByCategory;
	}, [hotkeysByCategory, searchQuery]);

	useEffect(() => {
		if (!recordingId) return;

		const handleKeyDown = (event: KeyboardEvent) => {
			event.preventDefault();
			event.stopPropagation();

			if (event.key === "Escape") {
				setRecordingId(null);
				return;
			}

			if (event.key === "Backspace" || event.key === "Delete") {
				setHotkey(recordingId, null);
				setRecordingId(null);
				return;
			}

			const captured = captureHotkeyFromEvent(event, platform);
			if (!captured) return;

			if (isTerminalReservedHotkey(captured)) {
				toast.error(t("settings.keyboard.toast.terminalReserved"));
				setRecordingId(null);
				return;
			}

			const conflictId = getHotkeyConflict(captured, recordingId);
			if (conflictId) {
				setPendingConflict({ id: recordingId, keys: captured, conflictId });
				setRecordingId(null);
				return;
			}

			if (isOsReservedHotkey(captured, platform)) {
				toast.warning(t("settings.keyboard.toast.osReserved"));
			}

			setHotkey(recordingId, captured);
			setRecordingId(null);
		};

		window.addEventListener("keydown", handleKeyDown, { capture: true });
		return () => {
			window.removeEventListener("keydown", handleKeyDown, { capture: true });
		};
	}, [recordingId, platform, setHotkey, t]);

	const handleStartRecording = (id: HotkeyId) => {
		setRecordingId((current) => (current === id ? null : id));
	};

	const handleExport = async () => {
		try {
			const result = await exportMutation.mutateAsync();
			if ("canceled" in result && result.canceled) return;
			if ("error" in result) {
				toast.error(t("settings.keyboard.toast.exportFailed"), {
					description: result.error,
				});
				return;
			}
			toast.success(t("settings.keyboard.toast.exported"), {
				description: result.path,
			});
		} catch (error) {
			toast.error(t("settings.keyboard.toast.exportFailed"), {
				description: error instanceof Error ? error.message : undefined,
			});
		}
	};

	const handleImport = async () => {
		try {
			const result = await importMutation.mutateAsync();
			if ("canceled" in result && result.canceled) return;
			if ("error" in result) {
				toast.error(t("settings.keyboard.toast.importFailed"), {
					description: result.error,
				});
				return;
			}
			setPendingImport({
				path: result.path,
				state: result.state,
				summary: result.summary,
			});
		} catch (error) {
			toast.error(t("settings.keyboard.toast.importFailed"), {
				description: error instanceof Error ? error.message : undefined,
			});
		}
	};

	const handleConfirmImport = () => {
		if (!pendingImport) return;
		replaceHotkeysState(pendingImport.state);
		toast.success(t("settings.keyboard.toast.imported"));
		setPendingImport(null);
	};

	const handleConflictReassign = () => {
		if (!pendingConflict) return;
		setHotkeysBatch({
			[pendingConflict.conflictId]: null,
			[pendingConflict.id]: pendingConflict.keys,
		});
		if (isOsReservedHotkey(pendingConflict.keys, platform)) {
			toast.warning(t("settings.keyboard.toast.osReserved"));
		}
		setPendingConflict(null);
	};

	return (
		<div className="p-6 w-full max-w-4xl">
			{/* Header */}
			<div className="mb-6 flex items-start justify-between gap-4">
				<div>
					<h2 className="text-lg font-semibold">
						{t("settings.keyboard.title")}
					</h2>
					<p className="text-sm text-muted-foreground mt-1">
						{t("settings.keyboard.introBefore")}
						<KbdGroup>
							{showHotkeysDisplay.map((key) => (
								<Kbd key={key}>{key}</Kbd>
							))}
						</KbdGroup>
						{t("settings.keyboard.introAfter")}
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Button variant="outline" size="sm" onClick={handleImport}>
						{t("settings.keyboard.import")}
					</Button>
					<Button variant="outline" size="sm" onClick={handleExport}>
						{t("settings.keyboard.export")}
					</Button>
					<Button
						variant="ghost"
						size="sm"
						onClick={() => {
							setRecordingId(null);
							resetAllHotkeys();
						}}
					>
						{t("settings.keyboard.resetAll")}
					</Button>
				</div>
			</div>

			{/* Search */}
			<div className="relative mb-6">
				<HiMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
				<Input
					type="text"
					placeholder={t("settings.keyboard.searchPlaceholder")}
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
					className="pl-9 bg-accent/30 border-transparent focus:border-accent"
				/>
			</div>

			{/* Tables by Category */}
			<div className="max-h-[calc(100vh-320px)] overflow-y-auto space-y-6">
				{CATEGORY_ORDER.map((category) => {
					const hotkeys = filteredHotkeysByCategory[category] ?? [];
					if (hotkeys.length === 0) return null;

					return (
						<div key={category}>
							<h3 className="text-sm font-medium text-muted-foreground mb-2">
								{category}
							</h3>
							<div className="rounded-lg border border-border overflow-hidden">
								<div className="flex items-center justify-between py-2 px-4 bg-accent/10 border-b border-border">
									<span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
										{t("settings.keyboard.command")}
									</span>
									<span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
										{t("settings.keyboard.shortcut")}
									</span>
								</div>
								<div className="divide-y divide-border">
									{hotkeys.map((hotkey) => (
										<HotkeyRow
											key={hotkey.id}
											id={hotkey.id}
											label={hotkey.label}
											description={hotkey.description}
											isRecording={recordingId === hotkey.id}
											onStartRecording={() => handleStartRecording(hotkey.id)}
											onReset={() => resetHotkey(hotkey.id)}
										/>
									))}
								</div>
							</div>
						</div>
					);
				})}

				{CATEGORY_ORDER.every(
					(cat) => (filteredHotkeysByCategory[cat] ?? []).length === 0,
				) && (
					<div className="py-8 text-center text-sm text-muted-foreground">
						{t("settings.keyboard.noResults", { query: searchQuery })}
					</div>
				)}
			</div>

			{/* Conflict dialog */}
			<AlertDialog
				open={!!pendingConflict}
				onOpenChange={() => setPendingConflict(null)}
			>
				<AlertDialogContent className="max-w-[380px] gap-0 p-0">
					<AlertDialogHeader className="px-4 pt-4 pb-2">
						<AlertDialogTitle className="font-medium">
							{t("settings.keyboard.conflict.title")}
						</AlertDialogTitle>
						<AlertDialogDescription asChild>
							<div className="text-muted-foreground space-y-1.5">
								<span className="block">
									{pendingConflict
										? t("settings.keyboard.conflict.assigned", {
												keys: formatHotkeyText(pendingConflict.keys, platform),
												label: HOTKEYS[pendingConflict.conflictId].label,
											})
										: ""}
								</span>
								<span className="block">
									{t("settings.keyboard.conflict.reassignQuestion")}
								</span>
							</div>
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter className="px-4 pb-4 pt-2 flex-row justify-end gap-2">
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setPendingConflict(null)}
						>
							{t("settings.keyboard.cancel")}
						</Button>
						<Button
							variant="secondary"
							size="sm"
							onClick={handleConflictReassign}
						>
							{t("settings.keyboard.conflict.reassign")}
						</Button>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* Import dialog */}
			<AlertDialog
				open={!!pendingImport}
				onOpenChange={() => setPendingImport(null)}
			>
				<AlertDialogContent className="max-w-[420px] gap-0 p-0">
					<AlertDialogHeader className="px-4 pt-4 pb-2">
						<AlertDialogTitle className="font-medium">
							{t("settings.keyboard.importDialog.title")}
						</AlertDialogTitle>
						<AlertDialogDescription asChild>
							<div className="text-muted-foreground space-y-1.5">
								<span className="block">
									{t("settings.keyboard.importDialog.replaceWarning")}
								</span>
								{pendingImport && (
									<span className="block">
										{t("settings.keyboard.importDialog.summary", {
											assigned: pendingImport.summary.assigned,
											disabled: pendingImport.summary.disabled,
											platform,
										})}
									</span>
								)}
							</div>
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter className="px-4 pb-4 pt-2 flex-row justify-end gap-2">
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setPendingImport(null)}
						>
							{t("settings.keyboard.cancel")}
						</Button>
						<Button variant="secondary" size="sm" onClick={handleConfirmImport}>
							{t("settings.keyboard.import")}
						</Button>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
