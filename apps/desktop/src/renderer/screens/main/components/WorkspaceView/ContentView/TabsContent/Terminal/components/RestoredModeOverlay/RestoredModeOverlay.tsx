import { Button } from "@superset/ui/button";
import { Card } from "@superset/ui/card";
import { useTranslation } from "react-i18next";
import { LuTerminal } from "react-icons/lu";

interface RestoredModeOverlayProps {
	onStartShell: () => void;
}

export function RestoredModeOverlay({
	onStartShell,
}: RestoredModeOverlayProps) {
	const { t } = useTranslation();
	return (
		<div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50">
			<Card className="gap-3 py-4 px-2">
				<div className="flex flex-col items-center text-center gap-1.5 px-4">
					<LuTerminal className="size-5 text-primary" />
					<div className="space-y-0.5">
						<p className="text-sm font-medium">
							{t("terminal.restored.title")}
						</p>
						<p className="text-xs text-muted-foreground">
							{t("terminal.restored.description")}
						</p>
					</div>
				</div>
				<div className="px-4">
					<Button size="sm" className="w-full" onClick={onStartShell}>
						{t("terminal.restored.startShell")}
					</Button>
				</div>
			</Card>
		</div>
	);
}
