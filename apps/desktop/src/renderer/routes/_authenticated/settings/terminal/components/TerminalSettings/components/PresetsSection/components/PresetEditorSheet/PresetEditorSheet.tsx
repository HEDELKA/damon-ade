import type { ExecutionMode, TerminalPreset } from "@superset/local-db";
import { Button } from "@superset/ui/button";
import { Checkbox } from "@superset/ui/checkbox";
import { Input } from "@superset/ui/input";
import { Label } from "@superset/ui/label";
import { RadioGroup, RadioGroupItem } from "@superset/ui/radio-group";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@superset/ui/select";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@superset/ui/sheet";
import { useTranslation } from "react-i18next";
import type { PresetColumnKey } from "renderer/routes/_authenticated/settings/presets/types";
import { CommandsEditor } from "../../../PresetRow/components/CommandsEditor";
import type { AutoApplyField } from "../../constants";
import { LabelWithTooltip } from "../LabelWithTooltip";

interface PresetEditorSheetProps {
	preset: TerminalPreset | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onDeletePreset: () => void;
	onFieldChange: (column: PresetColumnKey, value: string) => void;
	onFieldBlur: (column: PresetColumnKey) => void;
	onCommandsChange: (commands: string[]) => void;
	onCommandsBlur: () => void;
	onModeChange: (mode: ExecutionMode) => void;
	onToggleAutoApply: (field: AutoApplyField, enabled: boolean) => void;
	modeValue: ExecutionMode;
	hasMultipleCommands: boolean;
	isWorkspaceCreation: boolean;
	isNewTab: boolean;
}

export function PresetEditorSheet({
	preset,
	open,
	onOpenChange,
	onDeletePreset,
	onFieldChange,
	onFieldBlur,
	onCommandsChange,
	onCommandsBlur,
	onModeChange,
	onToggleAutoApply,
	modeValue,
	hasMultipleCommands,
	isWorkspaceCreation,
	isNewTab,
}: PresetEditorSheetProps) {
	const { t } = useTranslation();
	const singleCommandModeValue =
		modeValue === "split-pane" ? modeValue : "new-tab";

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="sm:max-w-xl w-full flex flex-col gap-0 p-0">
				{preset ? (
					<>
						<SheetHeader className="border-b pb-4">
							<SheetTitle className="text-sm font-medium">
								{preset.name.trim() ||
									t("settings.terminal.presets.editor.editTitle")}
							</SheetTitle>
							<SheetDescription>
								{t("settings.terminal.presets.editor.subtitle")}
							</SheetDescription>
						</SheetHeader>

						<div className="flex-1 overflow-y-auto p-4 space-y-6">
							<div className="space-y-2">
								<LabelWithTooltip
									label={t("settings.terminal.presets.editor.nameLabel")}
									htmlFor="preset-name"
									tooltip={t("settings.terminal.presets.editor.nameTooltip")}
								/>
								<Input
									id="preset-name"
									value={preset.name}
									onChange={(e) => onFieldChange("name", e.target.value)}
									onBlur={() => onFieldBlur("name")}
									placeholder={t(
										"settings.terminal.presets.editor.namePlaceholder",
									)}
								/>
							</div>

							<div className="space-y-2">
								<LabelWithTooltip
									label={t("settings.terminal.presets.editor.descriptionLabel")}
									htmlFor="preset-description"
									tooltip={t(
										"settings.terminal.presets.editor.descriptionTooltip",
									)}
								/>
								<Input
									id="preset-description"
									value={preset.description ?? ""}
									onChange={(e) => onFieldChange("description", e.target.value)}
									onBlur={() => onFieldBlur("description")}
									placeholder={t(
										"settings.terminal.presets.editor.descriptionPlaceholder",
									)}
								/>
							</div>

							<div className="space-y-2">
								<LabelWithTooltip
									label={t("settings.terminal.presets.editor.directoryLabel")}
									htmlFor="preset-directory"
									tooltip={t(
										"settings.terminal.presets.editor.directoryTooltip",
									)}
								/>
								<Input
									id="preset-directory"
									value={preset.cwd}
									onChange={(e) => onFieldChange("cwd", e.target.value)}
									onBlur={() => onFieldBlur("cwd")}
									placeholder={t(
										"settings.terminal.presets.editor.directoryPlaceholder",
									)}
								/>
							</div>

							<div className="space-y-2">
								<LabelWithTooltip
									label={t("settings.terminal.presets.editor.commandsLabel")}
									tooltip={t(
										"settings.terminal.presets.editor.commandsTooltip",
									)}
								/>
								<CommandsEditor
									commands={preset.commands}
									onChange={onCommandsChange}
									onBlur={onCommandsBlur}
									placeholder={t(
										"settings.terminal.presets.editor.commandsPlaceholder",
									)}
								/>
							</div>

							<div className="space-y-2">
								<LabelWithTooltip
									label={t("settings.terminal.presets.editor.launchModeLabel")}
									tooltip={t(
										"settings.terminal.presets.editor.launchModeTooltip",
									)}
								/>
								{hasMultipleCommands ? (
									<div className="rounded-md border border-border p-3">
										<RadioGroup
											value={modeValue}
											onValueChange={(value) =>
												onModeChange(value as ExecutionMode)
											}
											className="gap-3"
										>
											<div className="flex items-start gap-2">
												<RadioGroupItem
													id="preset-multi-command-split-pane"
													value="split-pane"
													className="mt-0.5"
												/>
												<Label
													htmlFor="preset-multi-command-split-pane"
													className="text-sm font-medium"
												>
													{t("settings.terminal.presets.editor.multiSplitPane")}
												</Label>
											</div>
											<div className="flex items-start gap-2">
												<RadioGroupItem
													id="preset-multi-command-new-tab"
													value="new-tab"
													className="mt-0.5"
												/>
												<Label
													htmlFor="preset-multi-command-new-tab"
													className="text-sm font-medium"
												>
													{t("settings.terminal.presets.editor.multiNewTab")}
												</Label>
											</div>
											<div className="flex items-start gap-2">
												<RadioGroupItem
													id="preset-multi-command-new-tab-split-pane"
													value="new-tab-split-pane"
													className="mt-0.5"
												/>
												<Label
													htmlFor="preset-multi-command-new-tab-split-pane"
													className="text-sm font-medium"
												>
													{t(
														"settings.terminal.presets.editor.multiNewTabSplitPane",
													)}
												</Label>
											</div>
										</RadioGroup>
									</div>
								) : (
									<Select
										value={singleCommandModeValue}
										onValueChange={(value) =>
											onModeChange(value as ExecutionMode)
										}
									>
										<SelectTrigger className="h-9 w-full">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="split-pane">
												{t("settings.terminal.presets.editor.singleCurrentTab")}
											</SelectItem>
											<SelectItem value="new-tab">
												{t("settings.terminal.presets.editor.singleNewTab")}
											</SelectItem>
										</SelectContent>
									</Select>
								)}
							</div>

							<div className="space-y-3 rounded-md border border-border p-3">
								<LabelWithTooltip
									label={t("settings.terminal.presets.editor.autoRunLabel")}
									className="text-sm font-medium"
									tooltip={t("settings.terminal.presets.editor.autoRunTooltip")}
								/>

								<div className="flex items-start gap-3">
									<Checkbox
										id="preset-workspace-autostart"
										checked={isWorkspaceCreation}
										onCheckedChange={(checked) =>
											onToggleAutoApply(
												"applyOnWorkspaceCreated",
												checked === true,
											)
										}
									/>
									<div className="space-y-0.5">
										<Label
											htmlFor="preset-workspace-autostart"
											className="text-sm font-medium"
										>
											{t(
												"settings.terminal.presets.editor.autoRunWorkspaceLabel",
											)}
										</Label>
										<p className="text-xs text-muted-foreground">
											{t(
												"settings.terminal.presets.editor.autoRunWorkspaceDescription",
											)}
										</p>
									</div>
								</div>

								<div className="flex items-start gap-3">
									<Checkbox
										id="preset-tab-autostart"
										checked={isNewTab}
										onCheckedChange={(checked) =>
											onToggleAutoApply("applyOnNewTab", checked === true)
										}
									/>
									<div className="space-y-0.5">
										<Label
											htmlFor="preset-tab-autostart"
											className="text-sm font-medium"
										>
											{t("settings.terminal.presets.editor.autoRunTabLabel")}
										</Label>
										<p className="text-xs text-muted-foreground">
											{t(
												"settings.terminal.presets.editor.autoRunTabDescription",
											)}
										</p>
									</div>
								</div>
							</div>
						</div>

						<SheetFooter className="border-t p-4 sm:flex-row sm:items-center sm:justify-between">
							<Button
								type="button"
								variant="destructive"
								size="sm"
								onClick={onDeletePreset}
							>
								{t("settings.terminal.presets.editor.delete")}
							</Button>
							<Button
								type="button"
								size="sm"
								onClick={() => onOpenChange(false)}
							>
								{t("settings.terminal.presets.editor.done")}
							</Button>
						</SheetFooter>
					</>
				) : null}
			</SheetContent>
		</Sheet>
	);
}
