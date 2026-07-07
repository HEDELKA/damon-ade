import { useTranslation } from "react-i18next";

export function FontPreview({
	fontFamily,
	fontSize,
	variant,
}: {
	fontFamily: string;
	fontSize: number;
	variant: "editor" | "terminal";
}) {
	const { t } = useTranslation();
	const isTerminal = variant === "terminal";
	return (
		<div
			className={`rounded-md border p-3 ${
				isTerminal ? "bg-[#1e1e1e] text-[#cccccc] border-[#333]" : "bg-muted/50"
			}`}
			style={{
				fontFamily: fontFamily || undefined,
				fontSize: `${fontSize}px`,
				lineHeight: 1.5,
				whiteSpace: "pre-wrap",
			}}
		>
			{t("settings.appearance.font.previewText")}
		</div>
	);
}
