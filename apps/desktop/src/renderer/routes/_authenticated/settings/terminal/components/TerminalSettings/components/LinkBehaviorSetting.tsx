import type { TerminalLinkBehavior } from "@superset/local-db";
import { Label } from "@superset/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@superset/ui/select";
import { useTranslation } from "react-i18next";
import { electronTrpc } from "renderer/lib/electron-trpc";

export function LinkBehaviorSetting() {
	const { t } = useTranslation();
	const utils = electronTrpc.useUtils();

	const { data: terminalLinkBehavior, isLoading } =
		electronTrpc.settings.getTerminalLinkBehavior.useQuery();

	const setTerminalLinkBehavior =
		electronTrpc.settings.setTerminalLinkBehavior.useMutation({
			onMutate: async ({ behavior }) => {
				await utils.settings.getTerminalLinkBehavior.cancel();
				const previous = utils.settings.getTerminalLinkBehavior.getData();
				utils.settings.getTerminalLinkBehavior.setData(undefined, behavior);
				return { previous };
			},
			onError: (_err, _vars, context) => {
				if (context?.previous !== undefined) {
					utils.settings.getTerminalLinkBehavior.setData(
						undefined,
						context.previous,
					);
				}
			},
			onSettled: () => {
				utils.settings.getTerminalLinkBehavior.invalidate();
			},
		});

	return (
		<div className="flex items-center justify-between">
			<div className="space-y-0.5">
				<Label htmlFor="terminal-link-behavior" className="text-sm font-medium">
					{t("settings.terminal.linkBehavior.label")}
				</Label>
				<p className="text-xs text-muted-foreground">
					{t("settings.terminal.linkBehavior.description")}
				</p>
			</div>
			<Select
				value={terminalLinkBehavior ?? "external-editor"}
				onValueChange={(value) =>
					setTerminalLinkBehavior.mutate({
						behavior: value as TerminalLinkBehavior,
					})
				}
				disabled={isLoading || setTerminalLinkBehavior.isPending}
			>
				<SelectTrigger className="w-[180px]">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="external-editor">
						{t("settings.terminal.linkBehavior.externalEditor")}
					</SelectItem>
					<SelectItem value="file-viewer">
						{t("settings.terminal.linkBehavior.fileViewer")}
					</SelectItem>
				</SelectContent>
			</Select>
		</div>
	);
}
