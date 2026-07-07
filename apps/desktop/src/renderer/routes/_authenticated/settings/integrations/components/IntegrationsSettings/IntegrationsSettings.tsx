import { COMPANY, FEATURE_FLAGS } from "@superset/shared/constants";
import { Badge } from "@superset/ui/badge";
import { Button } from "@superset/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
} from "@superset/ui/card";
import { Skeleton } from "@superset/ui/skeleton";
import { useLiveQuery } from "@tanstack/react-db";
import { useFeatureFlagEnabled } from "posthog-js/react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FaGithub, FaSlack } from "react-icons/fa";
import { HiCheckCircle, HiOutlineArrowTopRightOnSquare } from "react-icons/hi2";
import { SiLinear } from "react-icons/si";
import { env } from "renderer/env.renderer";
import { apiTrpcClient } from "renderer/lib/api-trpc-client";
import { authClient } from "renderer/lib/auth-client";
import { useCollections } from "renderer/routes/_authenticated/providers/CollectionsProvider";
import {
	isItemVisible,
	SETTING_ITEM_ID,
	type SettingItemId,
} from "../../../utils/settings-search";

interface IntegrationsSettingsProps {
	visibleItems?: SettingItemId[] | null;
}

interface GithubInstallation {
	id: string;
	accountLogin: string | null;
	accountType: string | null;
	suspended: boolean | null;
	lastSyncedAt: Date | null;
	createdAt: Date;
}

export function IntegrationsSettings({
	visibleItems,
}: IntegrationsSettingsProps) {
	const { t } = useTranslation();
	const { data: session } = authClient.useSession();
	const activeOrganizationId = session?.session?.activeOrganizationId;
	const collections = useCollections();

	const { data: integrations } = useLiveQuery(
		(q) =>
			q
				.from({ integrationConnections: collections.integrationConnections })
				.select(({ integrationConnections }) => ({
					...integrationConnections,
				})),
		[collections],
	);

	const [githubInstallation, setGithubInstallation] =
		useState<GithubInstallation | null>(null);
	const [isLoadingGithub, setIsLoadingGithub] = useState(true);

	const hasGithubAccess = useFeatureFlagEnabled(
		FEATURE_FLAGS.GITHUB_INTEGRATION_ACCESS,
	);
	const hasSlackAccess = useFeatureFlagEnabled(
		FEATURE_FLAGS.SLACK_INTEGRATION_ACCESS,
	);

	const showLinear = isItemVisible(
		SETTING_ITEM_ID.INTEGRATIONS_LINEAR,
		visibleItems,
	);
	const showGithub =
		hasGithubAccess &&
		isItemVisible(SETTING_ITEM_ID.INTEGRATIONS_GITHUB, visibleItems);

	const fetchGithubInstallation = useCallback(async () => {
		if (!activeOrganizationId) {
			setIsLoadingGithub(false);
			return;
		}

		try {
			const result =
				await apiTrpcClient.integration.github.getInstallation.query({
					organizationId: activeOrganizationId,
				});
			setGithubInstallation(result);
		} catch (err) {
			console.error("[integrations] Failed to fetch GitHub installation:", err);
		} finally {
			setIsLoadingGithub(false);
		}
	}, [activeOrganizationId]);

	useEffect(() => {
		fetchGithubInstallation();
	}, [fetchGithubInstallation]);

	const linearConnection = integrations?.find((i) => i.provider === "linear");
	const slackConnection = integrations?.find((i) => i.provider === "slack");
	const isLinearConnected = !!linearConnection;
	const isSlackConnected = !!slackConnection;
	const isGithubConnected =
		!!githubInstallation && !githubInstallation.suspended;
	const showSlack =
		hasSlackAccess &&
		isItemVisible(SETTING_ITEM_ID.INTEGRATIONS_SLACK, visibleItems);

	const handleOpenWeb = (path: string) => {
		window.open(`${env.NEXT_PUBLIC_WEB_URL}${path}`, "_blank");
	};

	if (!activeOrganizationId) {
		return (
			<div className="p-6 max-w-4xl w-full">
				<div className="mb-8">
					<h2 className="text-xl font-semibold">
						{t("settings.integrations.title")}
					</h2>
					<p className="text-sm text-muted-foreground mt-1">
						{t("settings.integrations.descriptionShort")}
					</p>
				</div>
				<p className="text-muted-foreground">
					{t("settings.integrations.needOrg")}
				</p>
			</div>
		);
	}

	return (
		<div className="p-6 max-w-4xl w-full">
			<div className="mb-8">
				<h2 className="text-xl font-semibold">
					{t("settings.integrations.title")}
				</h2>
				<p className="text-sm text-muted-foreground mt-1">
					{t("settings.integrations.description")}
				</p>
			</div>

			<div className="grid gap-4">
				{showLinear && (
					<IntegrationCard
						name="Linear"
						description={t("settings.integrations.linear.description")}
						icon={<SiLinear className="size-6" />}
						isConnected={isLinearConnected}
						connectedOrgName={linearConnection?.externalOrgName}
						onManage={() => handleOpenWeb("/integrations/linear")}
					/>
				)}

				{showGithub && (
					<IntegrationCard
						name="GitHub"
						description={t("settings.integrations.github.description")}
						icon={<FaGithub className="size-6" />}
						isConnected={isGithubConnected}
						connectedOrgName={githubInstallation?.accountLogin}
						isLoading={isLoadingGithub}
						onManage={() => handleOpenWeb("/integrations/github")}
					/>
				)}

				{showSlack && (
					<IntegrationCard
						name="Slack"
						description={t("settings.integrations.slack.description")}
						icon={<FaSlack className="size-6" />}
						isConnected={isSlackConnected}
						connectedOrgName={slackConnection?.externalOrgName}
						onManage={() => handleOpenWeb("/integrations/slack")}
					/>
				)}
			</div>

			<p className="mt-6 text-xs text-muted-foreground">
				{t("settings.integrations.manageHint")}{" "}
				<a
					href={`${COMPANY.DOCS_URL}/integrations`}
					target="_blank"
					rel="noopener noreferrer"
					className="inline-flex items-center gap-1 text-primary hover:underline"
				>
					{t("settings.integrations.learnMore")}
					<HiOutlineArrowTopRightOnSquare className="h-3 w-3" />
				</a>
			</p>
		</div>
	);
}

interface IntegrationCardProps {
	name: string;
	description: string;
	icon: React.ReactNode;
	isConnected: boolean;
	connectedOrgName?: string | null;
	isLoading?: boolean;
	onManage: () => void;
	comingSoon?: boolean;
}

function IntegrationCard({
	name,
	description,
	icon,
	isConnected,
	connectedOrgName,
	isLoading,
	onManage,
	comingSoon,
}: IntegrationCardProps) {
	const { t } = useTranslation();
	return (
		<Card>
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="flex size-10 items-center justify-center rounded-lg border bg-muted/50">
							{icon}
						</div>
						<div>
							<div className="flex items-center gap-2">
								<span className="font-medium">{name}</span>
								{isLoading ? (
									<Skeleton className="h-5 w-20" />
								) : isConnected ? (
									<Badge variant="default" className="gap-1">
										<HiCheckCircle className="size-3" />
										{t("settings.integrations.connected")}
									</Badge>
								) : comingSoon ? (
									<Badge variant="outline">
										{t("settings.integrations.comingSoon")}
									</Badge>
								) : (
									<Badge variant="secondary">
										{t("settings.integrations.notConnected")}
									</Badge>
								)}
							</div>
							<CardDescription className="mt-0.5">
								{description}
							</CardDescription>
						</div>
					</div>
					<Button
						variant="outline"
						size="sm"
						onClick={onManage}
						disabled={comingSoon}
						className="gap-2"
					>
						<HiOutlineArrowTopRightOnSquare className="size-4" />
						{isConnected
							? t("settings.integrations.manage")
							: t("settings.integrations.connect")}
					</Button>
				</div>
			</CardHeader>
			{isConnected && connectedOrgName && (
				<CardContent className="pt-0">
					<p className="text-sm text-muted-foreground">
						{t("settings.integrations.connectedTo")}{" "}
						<span className="font-medium">{connectedOrgName}</span>
					</p>
				</CardContent>
			)}
		</Card>
	);
}
