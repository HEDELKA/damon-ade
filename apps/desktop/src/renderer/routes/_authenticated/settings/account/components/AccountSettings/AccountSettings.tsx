import { Avatar } from "@superset/ui/atoms/Avatar";
import { Button } from "@superset/ui/button";
import { Card, CardContent } from "@superset/ui/card";
import { Input } from "@superset/ui/input";
import { toast } from "@superset/ui/sonner";
import { useLiveQuery } from "@tanstack/react-db";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiOutlinePencil } from "react-icons/hi2";
import { apiTrpcClient } from "renderer/lib/api-trpc-client";
import { authClient } from "renderer/lib/auth-client";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { useCollections } from "renderer/routes/_authenticated/providers/CollectionsProvider";
import {
	isItemVisible,
	SETTING_ITEM_ID,
	type SettingItemId,
} from "../../../utils/settings-search";
import { ProfileSkeleton } from "./components/ProfileSkeleton";

interface AccountSettingsProps {
	visibleItems?: SettingItemId[] | null;
}

export function AccountSettings({ visibleItems }: AccountSettingsProps) {
	const { t } = useTranslation();
	const showProfile = isItemVisible(
		SETTING_ITEM_ID.ACCOUNT_PROFILE,
		visibleItems,
	);
	const showSignOut = isItemVisible(
		SETTING_ITEM_ID.ACCOUNT_SIGNOUT,
		visibleItems,
	);

	const { data: session } = authClient.useSession();
	const currentUserId = session?.user?.id;
	const collections = useCollections();

	const [nameValue, setNameValue] = useState("");
	const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

	const { data: usersData, isLoading } = useLiveQuery(
		(q) => q.from({ users: collections.users }),
		[collections],
	);

	const user = usersData?.find((u) => u.id === currentUserId);

	const signOutMutation = electronTrpc.auth.signOut.useMutation({
		onSuccess: () => toast.success(t("settings.account.toast.signedOut")),
	});

	const selectImageMutation = electronTrpc.window.selectImageFile.useMutation();

	useEffect(() => {
		if (!user) return;
		setNameValue(user.name ?? "");
		setAvatarPreview(user.image ?? null);
	}, [user]);

	async function handleAvatarUpload() {
		if (!user) return;

		try {
			const result = await selectImageMutation.mutateAsync();
			if (result.canceled || !result.dataUrl) return;

			const mimeMatch = result.dataUrl.match(/^data:([^;]+);/);
			const mimeType = mimeMatch?.[1] || "image/png";
			const ext = mimeType.split("/")[1] || "png";

			const uploadResult = await apiTrpcClient.user.uploadAvatar.mutate({
				fileData: result.dataUrl,
				fileName: `avatar.${ext}`,
				mimeType,
			});

			setAvatarPreview(uploadResult.url);
			toast.success(t("settings.account.toast.avatarUpdated"));
		} catch {
			toast.error(t("settings.account.toast.avatarFailed"));
		}
	}

	async function handleNameBlur() {
		if (!user || nameValue === user.name) return;

		if (!nameValue) {
			setNameValue(user.name ?? "");
			return;
		}

		try {
			await apiTrpcClient.user.updateProfile.mutate({ name: nameValue });
			toast.success(t("settings.account.toast.nameUpdated"));
		} catch {
			toast.error(t("settings.account.toast.nameFailed"));
			setNameValue(user.name ?? "");
		}
	}

	return (
		<div className="p-6 max-w-4xl w-full">
			<div className="mb-8">
				<h2 className="text-xl font-semibold">{t("settings.account.title")}</h2>
				<p className="text-sm text-muted-foreground mt-1">
					{t("settings.account.description")}
				</p>
			</div>

			<div className="space-y-8">
				{showProfile && (
					<div>
						<h3 className="text-sm font-medium mb-4">
							{t("settings.account.profile")}
						</h3>
						{isLoading ? (
							<ProfileSkeleton />
						) : user ? (
							<Card>
								<CardContent>
									<ul className="space-y-6">
										<li className="flex items-center justify-between gap-8 pb-6 border-b border-border">
											<div className="flex-1">
												<div className="text-sm font-medium mb-1">
													{t("settings.account.avatar")}
												</div>
												<div className="text-xs text-muted-foreground">
													{t("settings.account.avatarHint")}
												</div>
											</div>
											<button
												type="button"
												onClick={handleAvatarUpload}
												className="relative w-8 h-8 group cursor-pointer"
											>
												<Avatar
													size="md"
													fullName={user.name}
													image={avatarPreview}
												/>
												<div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
													<HiOutlinePencil className="h-4 w-4 text-white" />
												</div>
											</button>
										</li>

										<li className="flex items-center justify-between gap-8 pb-6 border-b border-border">
											<div className="flex-1 text-sm font-medium">
												{t("settings.account.name")}
											</div>
											<div className="flex-1">
												<Input
													value={nameValue}
													onChange={(e) => setNameValue(e.target.value)}
													onBlur={handleNameBlur}
													placeholder={t("settings.account.namePlaceholder")}
													className="w-full"
												/>
											</div>
										</li>

										<li className="flex items-center justify-between gap-8">
											<div className="flex-1 text-sm font-medium">
												{t("settings.account.email")}
											</div>
											<div className="flex-1">
												<Input
													value={user.email}
													readOnly
													disabled
													className="w-full"
												/>
											</div>
										</li>
									</ul>
								</CardContent>
							</Card>
						) : (
							<Card>
								<CardContent>
									<p className="text-muted-foreground">
										{t("settings.account.unableToLoad")}
									</p>
								</CardContent>
							</Card>
						)}
					</div>
				)}

				{showSignOut && (
					<div className={showProfile ? "pt-6 border-t" : ""}>
						<h3 className="text-sm font-medium mb-2">
							{t("settings.account.signOut")}
						</h3>
						<p className="text-sm text-muted-foreground mb-4">
							{t("settings.account.signOutDescription")}
						</p>
						<Button variant="outline" onClick={() => signOutMutation.mutate()}>
							{t("settings.account.signOutButton")}
						</Button>
					</div>
				)}
			</div>
		</div>
	);
}
