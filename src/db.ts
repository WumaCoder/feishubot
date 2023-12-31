import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";

import { CLI_DB_FILE, SERVE_DB_FILE } from "./config.js";

export class ServeDbData {
	bindGitMembers: {
		feishuUserId: string;
		gitEmail: string;
	}[] = [];
	msgMap: Record<string, { branch: string; envServer: string }> = {};
}
export const ServeDb = new Low(
	new JSONFile<ServeDbData>(SERVE_DB_FILE),
	new ServeDbData(),
);

export class MessageSession {
	loading = -1;
	msgIds: string[] = [];
	opts: {
		btns?: { text: string; value: string }[];
		content?: string;
		foot_text?: string;
		template_id?: string;
		title?: string;
	} = {};
}
export class CliDbData {
	session: Record<string, MessageSession> = {};
}
export const CliDb = new Low(
	new JSONFile<CliDbData>(CLI_DB_FILE),
	new CliDbData(),
);
