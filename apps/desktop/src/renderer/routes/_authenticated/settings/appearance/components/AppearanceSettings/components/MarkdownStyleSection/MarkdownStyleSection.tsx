import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@superset/ui/select";
import { useTranslation } from "react-i18next";
import {
	type MarkdownStyle,
	useMarkdownStyle,
	useSetMarkdownStyle,
} from "renderer/stores";

export function MarkdownStyleSection() {
	const { t } = useTranslation();
	const markdownStyle = useMarkdownStyle();
	const setMarkdownStyle = useSetMarkdownStyle();

	return (
		<div>
			<h3 className="text-sm font-medium mb-2">
				{t("settings.appearance.markdown.heading")}
			</h3>
			<p className="text-sm text-muted-foreground mb-4">
				{t("settings.appearance.markdown.description")}
			</p>
			<Select
				value={markdownStyle}
				onValueChange={(value) => setMarkdownStyle(value as MarkdownStyle)}
			>
				<SelectTrigger className="w-[200px]">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="default">
						{t("settings.appearance.markdown.default")}
					</SelectItem>
					<SelectItem value="tufte">Tufte</SelectItem>
				</SelectContent>
			</Select>
			<p className="text-xs text-muted-foreground mt-2">
				{t("settings.appearance.markdown.hint")}
			</p>
		</div>
	);
}
