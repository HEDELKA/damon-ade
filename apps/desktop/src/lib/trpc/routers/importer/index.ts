import os from "node:os";
import path from "node:path";
import {
	type ImportResult,
	importProject,
	scanProjectsDir,
} from "main/lib/project-importer";
import { z } from "zod";
import { publicProcedure, router } from "../..";

const absoluteDirSchema = z
	.string()
	.min(1)
	.refine((value) => path.isAbsolute(value), {
		message: "Path must be absolute",
	});

function defaultDestBaseDir(): string {
	return path.join(os.homedir(), "ade-projects");
}

/**
 * Bulk project importer: scan a folder full of local projects, then import
 * them one by one — copy without library dirs, git init, private GitHub repo
 * via gh, Russian AI description, source moved to trash. Logic lives in
 * main/lib/project-importer; this router is the thin IPC surface.
 */
export const createImporterRouter = () => {
	return router({
		scan: publicProcedure
			.input(z.object({ dir: absoluteDirSchema }))
			.query(async ({ input }) => {
				return scanProjectsDir(input.dir);
			}),

		importOne: publicProcedure
			.input(
				z.object({
					sourcePath: absoluteDirSchema,
					destBaseDir: absoluteDirSchema.optional(),
					makePrivateRepo: z.boolean().default(true),
					trashSource: z.boolean().default(false),
				}),
			)
			.mutation(async ({ input }): Promise<ImportResult> => {
				return importProject({
					sourcePath: input.sourcePath,
					destBaseDir: input.destBaseDir ?? defaultDestBaseDir(),
					makePrivateRepo: input.makePrivateRepo,
					trashSource: input.trashSource,
				});
			}),
	});
};
