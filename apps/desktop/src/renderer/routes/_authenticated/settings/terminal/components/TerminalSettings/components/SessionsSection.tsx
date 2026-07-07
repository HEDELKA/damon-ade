import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@superset/ui/alert-dialog";
import { Button } from "@superset/ui/button";
import { Label } from "@superset/ui/label";
import { toast } from "@superset/ui/sonner";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { electronTrpc } from "renderer/lib/electron-trpc";

export function SessionsSection() {
	const { t } = useTranslation();
	const utils = electronTrpc.useUtils();

	const { data: daemonSessions } =
		electronTrpc.terminal.listDaemonSessions.useQuery();
	const sessions = daemonSessions?.sessions ?? [];
	const aliveSessions = useMemo(
		() => sessions.filter((session) => session.isAlive),
		[sessions],
	);
	const sessionsSorted = useMemo(() => {
		return [...aliveSessions].sort((a, b) => {
			if (a.attachedClients !== b.attachedClients) {
				return b.attachedClients - a.attachedClients;
			}
			const aTime = a.lastAttachedAt ? Date.parse(a.lastAttachedAt) : 0;
			const bTime = b.lastAttachedAt ? Date.parse(b.lastAttachedAt) : 0;
			return bTime - aTime;
		});
	}, [aliveSessions]);

	const [confirmKillAllOpen, setConfirmKillAllOpen] = useState(false);
	const [confirmClearHistoryOpen, setConfirmClearHistoryOpen] = useState(false);
	const [confirmRestartDaemonOpen, setConfirmRestartDaemonOpen] =
		useState(false);
	const [showSessionList, setShowSessionList] = useState(false);
	const [pendingKillSession, setPendingKillSession] = useState<{
		sessionId: string;
		workspaceId: string;
	} | null>(null);

	const killAllDaemonSessions =
		electronTrpc.terminal.killAllDaemonSessions.useMutation({
			onMutate: async () => {
				await utils.terminal.listDaemonSessions.cancel();
				const previous = utils.terminal.listDaemonSessions.getData();
				utils.terminal.listDaemonSessions.setData(undefined, {
					sessions: [],
				});
				return { previous };
			},
			onSuccess: (result) => {
				if (result.remainingCount > 0) {
					toast.warning(
						t("settings.terminal.sessions.toast.killAllSomeFailedTitle"),
						{
							description: t(
								"settings.terminal.sessions.toast.killAllSomeFailedDescription",
								{
									killed: result.killedCount,
									remaining: result.remainingCount,
								},
							),
						},
					);
				} else {
					toast.success(
						t("settings.terminal.sessions.toast.killAllSuccessTitle"),
						{
							description: t(
								"settings.terminal.sessions.toast.killAllSuccessDescription",
								{ count: result.killedCount },
							),
						},
					);
				}
			},
			onError: (error, _vars, context) => {
				if (context?.previous) {
					utils.terminal.listDaemonSessions.setData(
						undefined,
						context.previous,
					);
				}
				toast.error(t("settings.terminal.sessions.toast.killAllErrorTitle"), {
					description: error.message,
				});
			},
			onSettled: () => {
				setTimeout(() => {
					utils.terminal.listDaemonSessions.invalidate();
				}, 300);
			},
		});

	const clearTerminalHistory =
		electronTrpc.terminal.clearTerminalHistory.useMutation({
			onSuccess: () => {
				toast.success(
					t("settings.terminal.sessions.toast.clearHistorySuccess"),
				);
				utils.terminal.listDaemonSessions.invalidate();
			},
			onError: (error) => {
				toast.error(t("settings.terminal.sessions.toast.clearHistoryError"), {
					description: error.message,
				});
			},
		});

	const killDaemonSession = electronTrpc.terminal.kill.useMutation({
		onSuccess: () => {
			toast.success(t("settings.terminal.sessions.toast.killSessionSuccess"));
			utils.terminal.listDaemonSessions.invalidate();
		},
		onError: (error) => {
			toast.error(t("settings.terminal.sessions.toast.killSessionError"), {
				description: error.message,
			});
		},
	});

	const restartDaemon = electronTrpc.terminal.restartDaemon.useMutation({
		onSuccess: () => {
			toast.success(
				t("settings.terminal.sessions.toast.restartDaemonSuccessTitle"),
				{
					description: t(
						"settings.terminal.sessions.toast.restartDaemonSuccessDescription",
					),
				},
			);
			utils.terminal.listDaemonSessions.invalidate();
		},
		onError: (error) => {
			toast.error(
				t("settings.terminal.sessions.toast.restartDaemonErrorTitle"),
				{
					description: error.message,
				},
			);
		},
	});

	const formatTimestamp = (value?: string) => {
		if (!value) return "—";
		return value.replace("T", " ").replace(/\.\d+Z$/, "Z");
	};

	return (
		<>
			<div className="rounded-md border border-border/60 p-4 space-y-3">
				<div className="space-y-0.5">
					<div className="flex items-center justify-between">
						<Label className="text-sm font-medium">
							{t("settings.terminal.sessions.manage")}
						</Label>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => utils.terminal.listDaemonSessions.invalidate()}
						>
							{t("settings.terminal.sessions.refresh")}
						</Button>
					</div>
					<p className="text-xs text-muted-foreground">
						{t("settings.terminal.sessions.running", {
							count: aliveSessions.length,
						})}
					</p>
					{aliveSessions.length >= 20 && (
						<p className="text-xs text-muted-foreground/70">
							{t("settings.terminal.sessions.highUsageWarning")}
						</p>
					)}
				</div>

				<div className="flex flex-wrap gap-2">
					<Button
						variant="destructive"
						size="sm"
						disabled={
							aliveSessions.length === 0 || killAllDaemonSessions.isPending
						}
						onClick={() => setConfirmKillAllOpen(true)}
					>
						{t("settings.terminal.sessions.killAll")}
					</Button>
					<Button
						variant="secondary"
						size="sm"
						disabled={
							aliveSessions.length === 0 || clearTerminalHistory.isPending
						}
						onClick={() => setConfirmClearHistoryOpen(true)}
					>
						{t("settings.terminal.sessions.clearHistory")}
					</Button>
					<Button
						variant="outline"
						size="sm"
						disabled={restartDaemon.isPending}
						onClick={() => setConfirmRestartDaemonOpen(true)}
					>
						{t("settings.terminal.sessions.restartDaemon")}
					</Button>
					<Button
						variant="ghost"
						size="sm"
						disabled={aliveSessions.length === 0}
						onClick={() => setShowSessionList((v) => !v)}
					>
						{showSessionList
							? t("settings.terminal.sessions.hideSessions")
							: t("settings.terminal.sessions.showSessions")}
					</Button>
				</div>

				{showSessionList && aliveSessions.length > 0 && (
					<div className="rounded-md border border-border/60 overflow-hidden">
						<div className="max-h-64 overflow-auto">
							<table className="w-full text-xs">
								<thead className="sticky top-0 bg-background">
									<tr className="text-muted-foreground">
										<th className="px-2 py-2 text-left font-medium">
											{t("settings.terminal.sessions.table.agent")}
										</th>
										<th className="px-2 py-2 text-left font-medium">
											{t("settings.terminal.sessions.table.session")}
										</th>
										<th className="px-2 py-2 text-right font-medium">
											{t("settings.terminal.sessions.table.clients")}
										</th>
										<th className="px-2 py-2 text-right font-medium">
											{t("settings.terminal.sessions.table.pid")}
										</th>
										<th className="px-2 py-2 text-left font-medium">
											{t("settings.terminal.sessions.table.lastAttached")}
										</th>
										<th className="px-2 py-2 text-right font-medium">
											{t("settings.terminal.sessions.table.action")}
										</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-border/60">
									{sessionsSorted.map((session) => (
										<tr key={session.sessionId} className="hover:bg-muted/30">
											<td className="px-2 py-2 font-mono">
												{session.workspaceId}
											</td>
											<td className="px-2 py-2 font-mono">
												{session.sessionId}
											</td>
											<td className="px-2 py-2 text-right">
												{session.attachedClients}
											</td>
											<td className="px-2 py-2 text-right font-mono">
												{session.pid ?? "—"}
											</td>
											<td className="px-2 py-2">
												{formatTimestamp(session.lastAttachedAt)}
											</td>
											<td className="px-2 py-2 text-right">
												<Button
													variant="ghost"
													size="sm"
													onClick={() =>
														setPendingKillSession({
															sessionId: session.sessionId,
															workspaceId: session.workspaceId,
														})
													}
												>
													{t("settings.terminal.sessions.kill")}
												</Button>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</div>
				)}
			</div>

			<AlertDialog
				open={confirmKillAllOpen}
				onOpenChange={setConfirmKillAllOpen}
			>
				<AlertDialogContent className="max-w-[520px] gap-0 p-0">
					<AlertDialogHeader className="px-4 pt-4 pb-2">
						<AlertDialogTitle className="font-medium">
							{t("settings.terminal.sessions.dialog.killAllTitle")}
						</AlertDialogTitle>
						<AlertDialogDescription asChild>
							<div className="text-muted-foreground space-y-1.5">
								<span className="block">
									{t("settings.terminal.sessions.dialog.killAllLine1")}
								</span>
								<span className="block">
									{t("settings.terminal.sessions.dialog.killAllLine2")}
								</span>
							</div>
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter className="px-4 pb-4 pt-2 flex-row justify-end gap-2">
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setConfirmKillAllOpen(false)}
						>
							{t("settings.terminal.sessions.dialog.cancel")}
						</Button>
						<Button
							variant="destructive"
							size="sm"
							disabled={killAllDaemonSessions.isPending}
							onClick={() => {
								setConfirmKillAllOpen(false);
								killAllDaemonSessions.mutate();
							}}
						>
							{t("settings.terminal.sessions.dialog.killAllConfirm")}
						</Button>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<AlertDialog
				open={confirmClearHistoryOpen}
				onOpenChange={setConfirmClearHistoryOpen}
			>
				<AlertDialogContent className="max-w-[520px] gap-0 p-0">
					<AlertDialogHeader className="px-4 pt-4 pb-2">
						<AlertDialogTitle className="font-medium">
							{t("settings.terminal.sessions.dialog.clearHistoryTitle")}
						</AlertDialogTitle>
						<AlertDialogDescription asChild>
							<div className="text-muted-foreground space-y-1.5">
								<span className="block">
									{t("settings.terminal.sessions.dialog.clearHistoryLine1")}
								</span>
								<span className="block">
									{t("settings.terminal.sessions.dialog.clearHistoryLine2")}
								</span>
							</div>
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter className="px-4 pb-4 pt-2 flex-row justify-end gap-2">
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setConfirmClearHistoryOpen(false)}
						>
							{t("settings.terminal.sessions.dialog.cancel")}
						</Button>
						<Button
							variant="secondary"
							size="sm"
							disabled={clearTerminalHistory.isPending}
							onClick={() => {
								setConfirmClearHistoryOpen(false);
								clearTerminalHistory.mutate();
							}}
						>
							{t("settings.terminal.sessions.dialog.clearHistoryConfirm")}
						</Button>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<AlertDialog
				open={!!pendingKillSession}
				onOpenChange={(open) => {
					if (!open) setPendingKillSession(null);
				}}
			>
				<AlertDialogContent className="max-w-[520px] gap-0 p-0">
					<AlertDialogHeader className="px-4 pt-4 pb-2">
						<AlertDialogTitle className="font-medium">
							{t("settings.terminal.sessions.dialog.killSessionTitle")}
						</AlertDialogTitle>
						<AlertDialogDescription asChild>
							<div className="text-muted-foreground space-y-1.5">
								<span className="block">
									{t("settings.terminal.sessions.dialog.killSessionLine1")}
								</span>
								{pendingKillSession && (
									<span className="block font-mono text-xs">
										{pendingKillSession.workspaceId} /{" "}
										{pendingKillSession.sessionId}
									</span>
								)}
							</div>
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter className="px-4 pb-4 pt-2 flex-row justify-end gap-2">
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setPendingKillSession(null)}
						>
							{t("settings.terminal.sessions.dialog.cancel")}
						</Button>
						<Button
							variant="destructive"
							size="sm"
							disabled={killDaemonSession.isPending}
							onClick={() => {
								const sessionId = pendingKillSession?.sessionId;
								setPendingKillSession(null);
								if (!sessionId) return;
								killDaemonSession.mutate({ paneId: sessionId });
							}}
						>
							{t("settings.terminal.sessions.kill")}
						</Button>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<AlertDialog
				open={confirmRestartDaemonOpen}
				onOpenChange={setConfirmRestartDaemonOpen}
			>
				<AlertDialogContent className="max-w-[520px] gap-0 p-0">
					<AlertDialogHeader className="px-4 pt-4 pb-2">
						<AlertDialogTitle className="font-medium">
							{t("settings.terminal.sessions.dialog.restartDaemonTitle")}
						</AlertDialogTitle>
						<AlertDialogDescription asChild>
							<div className="text-muted-foreground space-y-1.5">
								<span className="block">
									{t("settings.terminal.sessions.dialog.restartDaemonLine1")}
								</span>
								<span className="block">
									{t("settings.terminal.sessions.dialog.restartDaemonLine2")}
								</span>
							</div>
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter className="px-4 pb-4 pt-2 flex-row justify-end gap-2">
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setConfirmRestartDaemonOpen(false)}
						>
							{t("settings.terminal.sessions.dialog.cancel")}
						</Button>
						<Button
							variant="default"
							size="sm"
							disabled={restartDaemon.isPending}
							onClick={() => {
								setConfirmRestartDaemonOpen(false);
								restartDaemon.mutate(undefined, {});
							}}
						>
							{t("settings.terminal.sessions.dialog.restartDaemonConfirm")}
						</Button>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
