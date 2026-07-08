import { Button } from "@superset/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@superset/ui/dialog";
import { Textarea } from "@superset/ui/textarea";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

interface EditDescriptionDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Current description; used to seed the textarea when the dialog opens. */
	initialValue: string;
	/** Persist the trimmed description (empty string clears it). */
	onSave: (description: string) => void;
	isSaving?: boolean;
}

/**
 * Small dialog for editing a team's or agent's description. Shared by the rail
 * "Edit description" context-menu actions on both the project header and the
 * workspace list item.
 */
export function EditDescriptionDialog({
	open,
	onOpenChange,
	initialValue,
	onSave,
	isSaving = false,
}: EditDescriptionDialogProps) {
	const { t } = useTranslation();
	const [value, setValue] = useState(initialValue);

	// biome-ignore lint/correctness/useExhaustiveDependencies: reset on each open
	useEffect(() => {
		if (open) setValue(initialValue);
	}, [open]);

	const handleSave = () => {
		onSave(value.trim());
		onOpenChange(false);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[440px]">
				<DialogHeader>
					<DialogTitle>{t("rail.description.title")}</DialogTitle>
				</DialogHeader>

				<Textarea
					value={value}
					onChange={(e) => setValue(e.target.value)}
					placeholder={t("rail.description.placeholder")}
					rows={4}
					// biome-ignore lint/a11y/noAutofocus: editing the description is the sole intent
					autoFocus
				/>

				<DialogFooter className="gap-2">
					<Button variant="ghost" onClick={() => onOpenChange(false)}>
						{t("common.cancel")}
					</Button>
					<Button onClick={handleSave} disabled={isSaving}>
						{t("common.save")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
