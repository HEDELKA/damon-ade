import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@superset/ui/alert-dialog";
import { Button } from "@superset/ui/button";
import { useTranslation } from "react-i18next";
import { LuLoader } from "react-icons/lu";

interface UnsavedChangesDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSaveAndSwitch: () => void;
	onDiscardAndSwitch: () => void;
	isSaving?: boolean;
}

export function UnsavedChangesDialog({
	open,
	onOpenChange,
	onSaveAndSwitch,
	onDiscardAndSwitch,
	isSaving = false,
}: UnsavedChangesDialogProps) {
	const { t } = useTranslation();
	const handleSaveAndSwitch = (e: React.MouseEvent) => {
		e.preventDefault();
		onSaveAndSwitch();
		// Don't close dialog - parent will close on success
	};

	const handleDiscardAndSwitch = (e: React.MouseEvent) => {
		e.preventDefault();
		onDiscardAndSwitch();
		onOpenChange(false);
	};

	return (
		<AlertDialog open={open} onOpenChange={isSaving ? undefined : onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>
						{t("workspaceView.viewer.unsaved.title")}
					</AlertDialogTitle>
					<AlertDialogDescription>
						{t("workspaceView.viewer.unsaved.description")}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={isSaving}>
						{t("workspaceView.viewer.unsaved.cancel")}
					</AlertDialogCancel>
					<Button
						variant="outline"
						onClick={handleDiscardAndSwitch}
						disabled={isSaving}
						className="border-destructive/50 text-destructive hover:bg-destructive/10"
					>
						{t("workspaceView.viewer.unsaved.discard")}
					</Button>
					<AlertDialogAction onClick={handleSaveAndSwitch} disabled={isSaving}>
						{isSaving ? (
							<>
								<LuLoader className="mr-2 h-4 w-4 animate-spin" />
								{t("workspaceView.viewer.unsaved.saving")}
							</>
						) : (
							t("workspaceView.viewer.unsaved.save")
						)}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
