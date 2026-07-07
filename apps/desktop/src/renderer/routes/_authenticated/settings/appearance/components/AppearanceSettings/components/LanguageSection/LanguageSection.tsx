import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@superset/ui/select";
import { useTranslation } from "react-i18next";
import {
	type AppLanguage,
	setAppLanguage,
	SUPPORTED_LANGUAGES,
} from "renderer/i18n";

export function LanguageSection() {
	const { t, i18n } = useTranslation();

	return (
		<div>
			<h3 className="text-sm font-medium mb-2">
				{t("settings.language.title")}
			</h3>
			<p className="text-sm text-muted-foreground mb-4">
				{t("settings.language.description")}
			</p>
			<Select
				value={i18n.language}
				onValueChange={(value) => setAppLanguage(value as AppLanguage)}
			>
				<SelectTrigger className="w-[200px]">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{SUPPORTED_LANGUAGES.map((lang) => (
						<SelectItem key={lang} value={lang}>
							{t(`settings.language.${lang}`)}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}
