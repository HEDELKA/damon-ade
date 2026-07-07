import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@superset/ui/alert-dialog";
import { Button } from "@superset/ui/button";
import { useTranslation } from "react-i18next";

interface CloseProjectDialogProps {
	projectName: string;
	workspaceCount: number;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => void;
}

export function CloseProjectDialog({
	projectName,
	workspaceCount,
	open,
	onOpenChange,
	onConfirm,
}: CloseProjectDialogProps) {
	const { t } = useTranslation();
	const handleConfirm = () => {
		onOpenChange(false);
		onConfirm();
	};

	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent className="max-w-[340px] gap-0 p-0">
				<AlertDialogHeader className="px-4 pt-4 pb-2">
					<AlertDialogTitle className="font-medium">
						{t("rail.closeTeamDialog.title", { name: projectName })}
					</AlertDialogTitle>
					<AlertDialogDescription asChild>
						<div className="text-muted-foreground space-y-1.5">
							<span className="block">
								{t("rail.closeTeamDialog.body", { count: workspaceCount })}
							</span>
							<span className="block">
								{t("rail.closeTeamDialog.filesRemain")}
							</span>
						</div>
					</AlertDialogDescription>
				</AlertDialogHeader>

				<AlertDialogFooter className="px-4 pb-4 pt-2 flex-row justify-end gap-2">
					<Button
						variant="ghost"
						size="sm"
						className="h-7 px-3 text-xs"
						onClick={() => onOpenChange(false)}
					>
						{t("common.cancel")}
					</Button>
					<Button
						variant="destructive"
						size="sm"
						className="h-7 px-3 text-xs"
						onClick={handleConfirm}
					>
						{t("rail.menu.closeTeam")}
					</Button>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
