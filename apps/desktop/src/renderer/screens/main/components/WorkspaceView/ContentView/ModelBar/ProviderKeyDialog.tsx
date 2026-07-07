import { Button } from "@superset/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@superset/ui/dialog";
import { Input } from "@superset/ui/input";
import { Label } from "@superset/ui/label";
import { toast } from "@superset/ui/sonner";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { useProviderKeys } from "renderer/stores/model-bar/useProviderKeys";

const OPENROUTER_KEYS_URL = "https://openrouter.ai/keys";

export type ProviderKeyDialogMode = "launch" | "manage";

interface ProviderKeyDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	mode: ProviderKeyDialogMode;
	/** For launch mode: the model whose launch is gated on the key. */
	modelLabel?: string;
	/** For launch mode: called after the key is saved so the caller can spawn. */
	onSaved?: () => void;
}

/**
 * Bring-your-own-key entry for OpenRouter. Two modes:
 * - launch: gate shown before spawning an OpenRouter-proxied model; saving the
 *   key immediately hands back to the caller to launch.
 * - manage: opened from the ModelBar "+" affordance to set / replace / clear the
 *   stored key. The stored key is never displayed.
 */
export function ProviderKeyDialog({
	open,
	onOpenChange,
	mode,
	modelLabel,
	onSaved,
}: ProviderKeyDialogProps) {
	const { t } = useTranslation();
	const { openrouterConfigured, setKey, clearKey, isSaving, isClearing } =
		useProviderKeys();
	const openUrl = electronTrpc.external.openUrl.useMutation();
	const [key, setKeyInput] = useState("");

	// biome-ignore lint/correctness/useExhaustiveDependencies: reset on each open
	useEffect(() => {
		if (open) setKeyInput("");
	}, [open]);

	const trimmed = key.trim();
	const canSave = trimmed.length > 0 && !isSaving;

	const handleSave = async () => {
		if (!canSave) return;
		try {
			await setKey(trimmed);
			setKeyInput("");
			if (mode === "launch") {
				onOpenChange(false);
				onSaved?.();
			} else {
				toast.success(t("modelBar.toast.keySaved"));
			}
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : t("modelBar.toast.saveFailed"),
			);
		}
	};

	const handleClear = async () => {
		try {
			await clearKey();
			setKeyInput("");
			toast.success(t("modelBar.toast.keyRemoved"));
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : t("modelBar.toast.removeFailed"),
			);
		}
	};

	const isLaunch = mode === "launch";
	const saveLabel = isLaunch
		? isSaving
			? t("modelBar.dialog.launching")
			: t("modelBar.dialog.saveAndLaunch")
		: isSaving
			? t("modelBar.dialog.saving")
			: openrouterConfigured
				? t("modelBar.dialog.replaceKey")
				: t("modelBar.dialog.saveKey");

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[440px]">
				<DialogHeader>
					<DialogTitle>
						{isLaunch
							? t("modelBar.dialog.connectTitle")
							: t("modelBar.dialog.manageTitle")}
					</DialogTitle>
					<DialogDescription>
						{isLaunch
							? t("modelBar.dialog.launchDescription", {
									model: modelLabel ?? t("modelBar.dialog.thisModel"),
								})
							: openrouterConfigured
								? t("modelBar.dialog.manageConfiguredDescription")
								: t("modelBar.dialog.manageDescription")}
						<button
							type="button"
							className="text-foreground underline underline-offset-2 hover:no-underline"
							onClick={() => openUrl.mutate(OPENROUTER_KEYS_URL)}
						>
							openrouter.ai/keys
						</button>
						.
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-1.5 py-1">
					<Label htmlFor="openrouter-key">
						{openrouterConfigured && !isLaunch
							? t("modelBar.dialog.newApiKey")
							: t("modelBar.dialog.apiKeyLabel")}
					</Label>
					<Input
						id="openrouter-key"
						type="password"
						autoComplete="off"
						spellCheck={false}
						value={key}
						onChange={(e) => setKeyInput(e.target.value)}
						placeholder="sk-or-…"
						// biome-ignore lint/a11y/noAutofocus: key entry is the sole intent
						autoFocus
						onKeyDown={(e) => {
							if (e.key === "Enter" && canSave) handleSave();
						}}
					/>
					{!isLaunch && (
						<p className="text-xs text-muted-foreground">
							{t("modelBar.dialog.applyNote")}
						</p>
					)}
				</div>

				<DialogFooter className="gap-2 sm:justify-between">
					{!isLaunch && openrouterConfigured ? (
						<Button
							variant="ghost"
							className="text-destructive hover:text-destructive"
							onClick={handleClear}
							disabled={isClearing}
						>
							{isClearing
								? t("modelBar.dialog.removing")
								: t("modelBar.dialog.removeKey")}
						</Button>
					) : (
						<span />
					)}
					<div className="flex justify-end gap-2">
						<Button variant="ghost" onClick={() => onOpenChange(false)}>
							{isLaunch ? t("common.cancel") : t("modelBar.dialog.done")}
						</Button>
						<Button onClick={handleSave} disabled={!canSave}>
							{saveLabel}
						</Button>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
