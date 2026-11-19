import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getAppUrl } from "./config.js";
import { detectImageType } from "./image-files.js";

const DIRECTORY = join(process.cwd(), ".local-images");
const FILE_NAME = /^[0-9a-f-]{36}\.(png|jpg|gif|webp)$/;

export async function putLocalImage(bytes) {
	if (process.env.NODE_ENV !== "development") throw new Error("Local images are only available in development");
	const type = detectImageType(bytes);
	if (!type) throw new Error("Invalid image");
	const pathname = `${randomUUID()}.${type.extension}`;
	await mkdir(DIRECTORY, { recursive: true });
	await writeFile(join(DIRECTORY, pathname), bytes, { flag: "wx" });
	return { url: `${getAppUrl()}/api/dev-images/${pathname}`, pathname };
}

export async function readLocalImage(name) {
	if (process.env.NODE_ENV !== "development" || !FILE_NAME.test(name)) return null;
	try {
		const bytes = await readFile(join(DIRECTORY, name));
		return { bytes, contentType: detectImageType(bytes).contentType };
	} catch (error) {
		if (error.code === "ENOENT") return null;
		throw error;
	}
}

export async function deleteLocalImage(url) {
	if (process.env.NODE_ENV !== "development") throw new Error("Local images are only available in development");
	const name = new URL(url).pathname.replace(/^\/api\/dev-images\//, "");
	if (!FILE_NAME.test(name)) throw new Error("Invalid local image path");
	await rm(join(DIRECTORY, name), { force: true });
}
