import { cn } from "@superset/ui/utils";
import { Link, useMatchRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
	HiOutlineBell,
	HiOutlineCommandLine,
	HiOutlineKey,
	HiOutlinePaintBrush,
	HiOutlinePuzzlePiece,
	HiOutlineShieldCheck,
	HiOutlineSparkles,
	HiOutlineUser,
} from "react-icons/hi2";
import { LuKeyboard } from "react-icons/lu";
import { electronTrpc } from "renderer/lib/electron-trpc";
import type { SettingsSection } from "renderer/stores/settings-state";

interface GeneralSettingsProps {
	matchCounts: Partial<Record<SettingsSection, number>> | null;
}

type SettingsRoute =
	| "/settings/account"
	| "/settings/appearance"
	| "/settings/ringtones"
	| "/settings/keyboard"
	| "/settings/behavior"
	| "/settings/terminal"
	| "/settings/integrations"
	| "/settings/api-keys"
	| "/settings/permissions";

const GENERAL_SECTIONS: {
	id: SettingsRoute;
	section: SettingsSection;
	labelKey: string;
	icon: React.ReactNode;
	macOnly?: boolean;
}[] = [
	{
		id: "/settings/account",
		section: "account",
		labelKey: "settings.sidebar.sections.account",
		icon: <HiOutlineUser className="h-4 w-4" />,
	},
	{
		id: "/settings/appearance",
		section: "appearance",
		labelKey: "settings.sidebar.sections.appearance",
		icon: <HiOutlinePaintBrush className="h-4 w-4" />,
	},
	{
		id: "/settings/ringtones",
		section: "ringtones",
		labelKey: "settings.sidebar.sections.notifications",
		icon: <HiOutlineBell className="h-4 w-4" />,
	},
	{
		id: "/settings/keyboard",
		section: "keyboard",
		labelKey: "settings.sidebar.sections.keyboard",
		icon: <LuKeyboard className="h-4 w-4" />,
	},
	{
		id: "/settings/behavior",
		section: "behavior",
		labelKey: "settings.sidebar.sections.features",
		icon: <HiOutlineSparkles className="h-4 w-4" />,
	},
	{
		id: "/settings/terminal",
		section: "terminal",
		labelKey: "settings.sidebar.sections.terminal",
		icon: <HiOutlineCommandLine className="h-4 w-4" />,
	},
	{
		id: "/settings/integrations",
		section: "integrations",
		labelKey: "settings.sidebar.sections.integrations",
		icon: <HiOutlinePuzzlePiece className="h-4 w-4" />,
	},
	{
		id: "/settings/api-keys",
		section: "apikeys",
		labelKey: "settings.sidebar.sections.apiKeys",
		icon: <HiOutlineKey className="h-4 w-4" />,
	},
	{
		id: "/settings/permissions",
		section: "permissions",
		labelKey: "settings.sidebar.sections.permissions",
		icon: <HiOutlineShieldCheck className="h-4 w-4" />,
		macOnly: true,
	},
];

export function GeneralSettings({ matchCounts }: GeneralSettingsProps) {
	const { t } = useTranslation();
	const matchRoute = useMatchRoute();
	const { data: platform } = electronTrpc.window.getPlatform.useQuery();
	const isMac = platform === "darwin";

	const platformSections = GENERAL_SECTIONS.filter(
		(section) => !section.macOnly || isMac,
	);
	const filteredSections = matchCounts
		? platformSections.filter(
				(section) => (matchCounts[section.section] ?? 0) > 0,
			)
		: platformSections;

	if (filteredSections.length === 0) {
		return null;
	}

	return (
		<div className="mb-4">
			<h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 mb-2">
				{t("settings.sidebar.general")}
			</h2>
			<nav className="flex flex-col gap-0.5">
				{filteredSections.map((section) => {
					const isActive = matchRoute({ to: section.id });
					const count = matchCounts?.[section.section];

					return (
						<Link
							key={section.id}
							to={section.id}
							className={cn(
								"flex items-center gap-3 px-3 py-1.5 text-sm rounded-md transition-colors text-left",
								isActive
									? "bg-accent text-accent-foreground"
									: "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground",
							)}
						>
							{section.icon}
							<span className="flex-1">{t(section.labelKey)}</span>
							{count !== undefined && count > 0 && (
								<span className="text-xs text-muted-foreground bg-accent/50 px-1.5 py-0.5 rounded">
									{count}
								</span>
							)}
						</Link>
					);
				})}
			</nav>
		</div>
	);
}
