import type { TerminalPreset } from "@superset/local-db";
import type { RefObject } from "react";
import { useTranslation } from "react-i18next";
import { PresetRow } from "../../../PresetRow";

interface PresetsTableProps {
	presets: TerminalPreset[];
	isLoading: boolean;
	presetsContainerRef: RefObject<HTMLDivElement | null>;
	onEdit: (presetId: string) => void;
	onLocalReorder: (fromIndex: number, toIndex: number) => void;
	onPersistReorder: (presetId: string, targetIndex: number) => void;
}

export function PresetsTable({
	presets,
	isLoading,
	presetsContainerRef,
	onEdit,
	onLocalReorder,
	onPersistReorder,
}: PresetsTableProps) {
	const { t } = useTranslation();
	return (
		<div className="rounded-lg border border-border overflow-hidden">
			<div className="flex items-center gap-4 py-2 px-4 bg-accent/10 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wider">
				<div className="w-6 shrink-0" />
				<div className="flex-1 min-w-0">
					{t("settings.terminal.presets.table.preset")}
				</div>
				<div className="flex-[1.2] min-w-0">
					{t("settings.terminal.presets.table.commands")}
				</div>
				<div className="w-32 shrink-0">
					{t("settings.terminal.presets.table.mode")}
				</div>
				<div className="w-36 shrink-0">
					{t("settings.terminal.presets.table.autoRun")}
				</div>
			</div>

			<div
				ref={presetsContainerRef}
				className="max-h-[320px] overflow-y-auto overflow-x-auto"
			>
				{isLoading ? (
					<div className="py-8 text-center text-sm text-muted-foreground">
						{t("settings.terminal.presets.table.loading")}
					</div>
				) : presets.length > 0 ? (
					presets.map((preset, index) => (
						<PresetRow
							key={preset.id}
							preset={preset}
							rowIndex={index}
							isEven={index % 2 === 0}
							onEdit={onEdit}
							onLocalReorder={onLocalReorder}
							onPersistReorder={onPersistReorder}
						/>
					))
				) : (
					<div className="py-8 text-center text-sm text-muted-foreground">
						{t("settings.terminal.presets.table.empty")}
					</div>
				)}
			</div>
		</div>
	);
}
