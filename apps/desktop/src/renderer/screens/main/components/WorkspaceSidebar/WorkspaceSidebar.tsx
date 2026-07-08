import { Tooltip, TooltipContent, TooltipTrigger } from "@superset/ui/tooltip";
import { FolderInput } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuPlus } from "react-icons/lu";
import { ImportProjectsDialog } from "renderer/components/ImportProjectsDialog";
import { useWorkspaceShortcuts } from "renderer/hooks/useWorkspaceShortcuts";
import { useOpenNewCategoryModal } from "renderer/stores/new-category-modal";
import { PortsList } from "./PortsList";
import { ProjectSection } from "./ProjectSection";
import { SidebarDropZone } from "./SidebarDropZone";

interface WorkspaceSidebarProps {
	isCollapsed?: boolean;
	activeProjectId: string | null;
	activeProjectName: string | null;
}

export function WorkspaceSidebar({
	isCollapsed = false,
}: WorkspaceSidebarProps) {
	const { groups } = useWorkspaceShortcuts();
	const openNewCategory = useOpenNewCategoryModal();
	const { t } = useTranslation();
	const [isImportOpen, setIsImportOpen] = useState(false);

	// Calculate shortcut base indices for each project group using cumulative offsets
	const projectShortcutIndices = useMemo(
		() =>
			groups.reduce<{ indices: number[]; cumulative: number }>(
				(acc, group) => ({
					indices: [...acc.indices, acc.cumulative],
					cumulative: acc.cumulative + group.workspaces.length,
				}),
				{ indices: [], cumulative: 0 },
			).indices,
		[groups],
	);

	return (
		<SidebarDropZone className="flex flex-col h-full bg-muted/45 dark:bg-muted/35">
			{!isCollapsed && (
				<div className="flex items-center justify-between px-3 h-10 shrink-0">
					<span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
						{t("rail.teams")}
					</span>
					<Tooltip>
						<TooltipTrigger asChild>
							<button
								type="button"
								onClick={() => openNewCategory()}
								className="flex items-center justify-center size-6 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
								aria-label={t("rail.newTeam")}
							>
								<LuPlus className="size-4" />
							</button>
						</TooltipTrigger>
						<TooltipContent side="right">{t("rail.newTeam")}</TooltipContent>
					</Tooltip>
				</div>
			)}
			<div className="flex-1 overflow-y-auto hide-scrollbar">
				{groups.map((group, index) => (
					<ProjectSection
						key={group.project.id}
						projectId={group.project.id}
						projectName={group.project.name}
						projectDescription={group.project.description}
						projectColor={group.project.color}
						githubOwner={group.project.githubOwner}
						mainRepoPath={group.project.mainRepoPath}
						hideImage={group.project.hideImage}
						iconUrl={group.project.iconUrl}
						workspaces={group.workspaces}
						shortcutBaseIndex={projectShortcutIndices[index]}
						index={index}
						isCollapsed={isCollapsed}
					/>
				))}

				{groups.length === 0 && !isCollapsed && (
					<div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm px-4 text-center">
						<span>{t("rail.noTeamsYet")}</span>
						<button
							type="button"
							onClick={() => openNewCategory()}
							className="text-xs mt-2 text-foreground underline underline-offset-2"
						>
							{t("rail.createFirstTeam")}
						</button>
					</div>
				)}
			</div>

			{!isCollapsed && (
				<div className="px-3 py-2 border-t border-border">
					<Tooltip delayDuration={300}>
						<TooltipTrigger asChild>
							<button
								type="button"
								onClick={() => setIsImportOpen(true)}
								className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
								aria-label={t("importer.title")}
							>
								<FolderInput className="size-4" />
								{t("importer.title")}
							</button>
						</TooltipTrigger>
						<TooltipContent side="top">{t("importer.title")}</TooltipContent>
					</Tooltip>
				</div>
			)}

			{!isCollapsed && <PortsList />}

			<ImportProjectsDialog
				open={isImportOpen}
				onOpenChange={setIsImportOpen}
			/>
		</SidebarDropZone>
	);
}
