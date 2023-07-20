import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";

import { DB_FILE } from "./config.js";

const adapter = new JSONFile<DbData>(DB_FILE);
const defaultData = { bindGitMembers: [] };
const db = new Low(adapter, defaultData);

export interface DbData {
	bindGitMembers: {
		feishuUserId: string;
		gitEmail: string;
	}[];
}

export default db;
