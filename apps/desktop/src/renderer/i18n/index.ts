import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import ru from "./locales/ru.json";

export const LANGUAGE_STORAGE_KEY = "ade-language";
export const SUPPORTED_LANGUAGES = ["en", "ru"] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

function isSupportedLanguage(value: unknown): value is AppLanguage {
	return (
		typeof value === "string" &&
		(SUPPORTED_LANGUAGES as readonly string[]).includes(value)
	);
}

export function detectInitialLanguage(): AppLanguage {
	try {
		const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
		if (isSupportedLanguage(stored)) return stored;
	} catch {
		// storage unavailable — fall through to navigator detection
	}
	const navLang = navigator.language?.toLowerCase() ?? "";
	return navLang.startsWith("ru") ? "ru" : "en";
}

export function setAppLanguage(language: AppLanguage): void {
	try {
		localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
	} catch {
		// storage unavailable — the change still applies for this session
	}
	void i18n.changeLanguage(language);
}

void i18n.use(initReactI18next).init({
	resources: {
		en: { translation: en },
		ru: { translation: ru },
	},
	lng: detectInitialLanguage(),
	fallbackLng: "en",
	interpolation: {
		// React already escapes rendered strings.
		escapeValue: false,
	},
	returnEmptyString: false,
});

export default i18n;
