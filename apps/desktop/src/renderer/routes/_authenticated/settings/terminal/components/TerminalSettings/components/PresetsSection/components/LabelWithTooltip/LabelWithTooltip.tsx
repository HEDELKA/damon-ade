import { Label } from "@superset/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@superset/ui/tooltip";
import { useTranslation } from "react-i18next";
import { HiOutlineQuestionMarkCircle } from "react-icons/hi2";

interface LabelWithTooltipProps {
	label: string;
	tooltip: string;
	htmlFor?: string;
	className?: string;
}

export function LabelWithTooltip({
	label,
	tooltip,
	htmlFor,
	className,
}: LabelWithTooltipProps) {
	const { t } = useTranslation();
	return (
		<div className="flex items-center gap-1.5">
			<Label htmlFor={htmlFor} className={className}>
				{label}
			</Label>
			<Tooltip>
				<TooltipTrigger asChild>
					<button
						type="button"
						className="text-muted-foreground hover:text-foreground transition-colors"
						aria-label={t("settings.terminal.presets.labelTooltipAria", {
							label,
						})}
					>
						<HiOutlineQuestionMarkCircle className="h-3.5 w-3.5" />
					</button>
				</TooltipTrigger>
				<TooltipContent side="top" className="max-w-xs text-xs">
					{tooltip}
				</TooltipContent>
			</Tooltip>
		</div>
	);
}
