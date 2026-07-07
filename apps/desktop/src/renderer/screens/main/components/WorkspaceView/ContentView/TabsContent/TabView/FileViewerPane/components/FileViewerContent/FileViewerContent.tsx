import Editor, { type OnMount } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import {
	type MutableRefObject,
	type RefObject,
	useCallback,
	useEffect,
	useRef,
} from "react";
import { useTranslation } from "react-i18next";
import { LuLoader } from "react-icons/lu";
import { MarkdownRenderer } from "renderer/components/MarkdownRenderer";
import {
	registerSaveAction,
	SUPERSET_THEME,
	useMonacoEditorOptions,
	useMonacoReady,
} from "renderer/providers/MonacoProvider";
import type { Tab } from "renderer/stores/tabs/types";
import type { DiffViewMode } from "shared/changes-types";
import { detectLanguage } from "shared/detect-language";
import { isImageFile } from "shared/file-types";
import type { FileViewerMode } from "shared/tabs-types";
import { DiffViewer } from "../../../../../../ChangesContent/components/DiffViewer";
import { registerCopyPathLineAction } from "../../../../../components/EditorContextMenu";
import { FileEditorContextMenu } from "../FileEditorContextMenu";
import { MarkdownSearch } from "../MarkdownSearch";

interface RawFileData {
	ok: true;
	content: string;
}

interface RawFileError {
	ok: false;
	reason:
		| "too-large"
		| "binary"
		| "outside-worktree"
		| "symlink-escape"
		| "not-found";
}

type RawFileResult = RawFileData | RawFileError | undefined;

interface ImageData {
	ok: true;
	dataUrl: string;
	byteLength: number;
}

interface ImageError {
	ok: false;
	reason:
		| "too-large"
		| "not-image"
		| "outside-worktree"
		| "symlink-escape"
		| "not-found";
}

type ImageResult = ImageData | ImageError | undefined;

interface DiffData {
	original: string;
	modified: string;
	language: string;
}

interface FileViewerContentProps {
	viewMode: FileViewerMode;
	filePath: string;
	isLoadingRaw: boolean;
	isLoadingImage?: boolean;
	isLoadingDiff: boolean;
	rawFileData: RawFileResult;
	imageData?: ImageResult;
	diffData: DiffData | undefined;
	isDiffEditable: boolean;
	editorRef: MutableRefObject<Monaco.editor.IStandaloneCodeEditor | null>;
	originalContentRef: MutableRefObject<string>;
	draftContentRef: MutableRefObject<string | null>;
	initialLine?: number;
	initialColumn?: number;
	diffViewMode: DiffViewMode;
	hideUnchangedRegions: boolean;
	onSaveRaw: () => Promise<void>;
	onSaveDiff?: (content: string) => Promise<void>;
	onEditorChange: (value: string | undefined) => void;
	onDiffChange?: (content: string) => void;
	setIsDirty: (dirty: boolean) => void;
	// Context menu props
	onSplitHorizontal: () => void;
	onSplitVertical: () => void;
	onClosePane: () => void;
	currentTabId: string;
	availableTabs: Tab[];
	onMoveToTab: (tabId: string) => void;
	onMoveToNewTab: () => void;
	// Markdown search props
	markdownContainerRef: RefObject<HTMLDivElement | null>;
	markdownSearch: {
		isSearchOpen: boolean;
		query: string;
		caseSensitive: boolean;
		matchCount: number;
		activeMatchIndex: number;
		setQuery: (query: string) => void;
		setCaseSensitive: (caseSensitive: boolean) => void;
		findNext: () => void;
		findPrevious: () => void;
		closeSearch: () => void;
	};
}

export function FileViewerContent({
	viewMode,
	filePath,
	isLoadingRaw,
	isLoadingImage,
	isLoadingDiff,
	rawFileData,
	imageData,
	diffData,
	isDiffEditable,
	editorRef,
	originalContentRef,
	draftContentRef,
	initialLine,
	initialColumn,
	diffViewMode,
	hideUnchangedRegions,
	onSaveRaw,
	onSaveDiff,
	onEditorChange,
	onDiffChange,
	setIsDirty,
	// Context menu props
	onSplitHorizontal,
	onSplitVertical,
	onClosePane,
	currentTabId,
	availableTabs,
	onMoveToTab,
	onMoveToNewTab,
	// Markdown search props
	markdownContainerRef,
	markdownSearch,
}: FileViewerContentProps) {
	const { t } = useTranslation();
	const isImage = isImageFile(filePath);
	const isMonacoReady = useMonacoReady();
	const monacoEditorOptions = useMonacoEditorOptions();
	const hasAppliedInitialLocationRef = useRef(false);

	// biome-ignore lint/correctness/useExhaustiveDependencies: Reset on file change only
	useEffect(() => {
		hasAppliedInitialLocationRef.current = false;
	}, [filePath]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: Only reset when coordinates change
	useEffect(() => {
		hasAppliedInitialLocationRef.current = false;
	}, [initialLine, initialColumn]);

	const handleEditorMount: OnMount = useCallback(
		(editor) => {
			editorRef.current = editor;
			if (!draftContentRef.current) {
				originalContentRef.current = editor.getValue();
			}
			setIsDirty(editor.getValue() !== originalContentRef.current);
			registerSaveAction(editor, onSaveRaw);
			registerCopyPathLineAction(editor, filePath);
		},
		[
			onSaveRaw,
			editorRef,
			originalContentRef,
			draftContentRef,
			setIsDirty,
			filePath,
		],
	);

	useEffect(() => {
		if (
			viewMode !== "raw" ||
			!editorRef.current ||
			!initialLine ||
			hasAppliedInitialLocationRef.current ||
			isLoadingRaw ||
			!rawFileData?.ok
		) {
			return;
		}

		const editor = editorRef.current;
		const model = editor.getModel();
		if (!model) return;

		const lineCount = model.getLineCount();
		const safeLine = Math.max(1, Math.min(initialLine, lineCount));
		const maxColumn = model.getLineMaxColumn(safeLine);
		const safeColumn = Math.max(1, Math.min(initialColumn ?? 1, maxColumn));

		const position = { lineNumber: safeLine, column: safeColumn };
		editor.setPosition(position);
		editor.revealPositionInCenter(position);
		editor.focus();

		hasAppliedInitialLocationRef.current = true;
	}, [
		viewMode,
		initialLine,
		initialColumn,
		isLoadingRaw,
		rawFileData,
		editorRef,
	]);

	if (viewMode === "diff") {
		if (isLoadingDiff) {
			return (
				<div className="flex items-center justify-center h-full text-muted-foreground">
					{t("workspaceView.viewer.loadingDiff")}
				</div>
			);
		}
		if (!diffData) {
			return (
				<div className="flex items-center justify-center h-full text-muted-foreground">
					{t("workspaceView.viewer.noDiff")}
				</div>
			);
		}
		return (
			<DiffViewer
				key={filePath}
				contents={{
					original: diffData.original,
					modified: diffData.modified,
					language: diffData.language,
				}}
				viewMode={diffViewMode}
				hideUnchangedRegions={hideUnchangedRegions}
				filePath={filePath}
				editable={isDiffEditable}
				onSave={isDiffEditable ? onSaveDiff : undefined}
				onChange={isDiffEditable ? onDiffChange : undefined}
				contextMenuProps={{
					onSplitHorizontal,
					onSplitVertical,
					onClosePane,
					currentTabId,
					availableTabs,
					onMoveToTab,
					onMoveToNewTab,
				}}
			/>
		);
	}

	// Handle image files in rendered mode
	if (viewMode === "rendered" && isImage) {
		if (isLoadingImage) {
			return (
				<div className="flex items-center justify-center h-full text-muted-foreground">
					<LuLoader className="w-4 h-4 animate-spin mr-2" />
					<span>{t("workspaceView.viewer.loadingImage")}</span>
				</div>
			);
		}

		if (!imageData?.ok) {
			const errorMessage =
				imageData?.reason === "too-large"
					? t("workspaceView.viewer.imageTooLarge")
					: imageData?.reason === "outside-worktree"
						? t("workspaceView.viewer.outsideWorktree")
						: imageData?.reason === "symlink-escape"
							? t("workspaceView.viewer.symlinkEscape")
							: imageData?.reason === "not-image"
								? t("workspaceView.viewer.notImage")
								: t("workspaceView.viewer.imageNotFound");
			return (
				<div className="flex items-center justify-center h-full text-muted-foreground">
					{errorMessage}
				</div>
			);
		}

		return (
			<div className="flex items-center justify-center h-full overflow-auto p-4 bg-[#0d0d0d]">
				<img
					src={imageData.dataUrl}
					alt={filePath.split("/").pop() || t("workspaceView.viewer.imageAlt")}
					className="max-w-full max-h-full object-contain"
					style={{ imageRendering: "auto" }}
				/>
			</div>
		);
	}

	if (isLoadingRaw) {
		return (
			<div className="flex items-center justify-center h-full text-muted-foreground">
				{t("workspaceView.viewer.loading")}
			</div>
		);
	}

	if (!rawFileData?.ok) {
		const errorMessage =
			rawFileData?.reason === "too-large"
				? t("workspaceView.viewer.fileTooLarge")
				: rawFileData?.reason === "binary"
					? t("workspaceView.viewer.binaryNotSupported")
					: rawFileData?.reason === "outside-worktree"
						? t("workspaceView.viewer.outsideWorktree")
						: rawFileData?.reason === "symlink-escape"
							? t("workspaceView.viewer.symlinkEscape")
							: t("workspaceView.viewer.fileNotFound");
		return (
			<div className="flex items-center justify-center h-full text-muted-foreground">
				{errorMessage}
			</div>
		);
	}

	if (viewMode === "rendered") {
		return (
			<div className="relative h-full">
				<MarkdownSearch
					isOpen={markdownSearch.isSearchOpen}
					query={markdownSearch.query}
					caseSensitive={markdownSearch.caseSensitive}
					matchCount={markdownSearch.matchCount}
					activeMatchIndex={markdownSearch.activeMatchIndex}
					onQueryChange={markdownSearch.setQuery}
					onCaseSensitiveChange={markdownSearch.setCaseSensitive}
					onFindNext={markdownSearch.findNext}
					onFindPrevious={markdownSearch.findPrevious}
					onClose={markdownSearch.closeSearch}
				/>
				<div ref={markdownContainerRef} className="p-4 overflow-auto h-full">
					<MarkdownRenderer content={rawFileData.content} />
				</div>
			</div>
		);
	}

	if (!isMonacoReady) {
		return (
			<div className="flex items-center justify-center h-full text-muted-foreground">
				<LuLoader className="w-4 h-4 animate-spin mr-2" />
				<span>{t("workspaceView.viewer.loadingEditor")}</span>
			</div>
		);
	}

	return (
		<FileEditorContextMenu
			editorRef={editorRef}
			filePath={filePath}
			onSplitHorizontal={onSplitHorizontal}
			onSplitVertical={onSplitVertical}
			onClosePane={onClosePane}
			currentTabId={currentTabId}
			availableTabs={availableTabs}
			onMoveToTab={onMoveToTab}
			onMoveToNewTab={onMoveToNewTab}
		>
			<div className="w-full h-full">
				<Editor
					key={filePath}
					height="100%"
					language={detectLanguage(filePath)}
					value={draftContentRef.current ?? rawFileData.content}
					theme={SUPERSET_THEME}
					onMount={handleEditorMount}
					onChange={onEditorChange}
					loading={
						<div className="flex items-center justify-center h-full text-muted-foreground">
							<LuLoader className="w-4 h-4 animate-spin mr-2" />
							<span>{t("workspaceView.viewer.loadingEditor")}</span>
						</div>
					}
					options={{
						...monacoEditorOptions,
						contextmenu: false, // Disable Monaco's native context menu to use our custom one
					}}
				/>
			</div>
		</FileEditorContextMenu>
	);
}
