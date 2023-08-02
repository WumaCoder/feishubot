import axios from "axios";
import { CleanOptions, simpleGit } from "simple-git";

import { BOT_SERVE } from "./config.js";

export function parseBtns(btns: string[]) {
	if (!btns) {
		return [];
	}

	return btns.map((item) => {
		const [text, value] = item.split(":");
		return { text, value };
	});
}

export const createContent = async (
	{
		template_id,
		...template_variable
	}: {
		btns: any;
		content: string;
		foot_text: string;
		template_id: string;
		title: string;
	},
	type: "interactive" | "text" = "interactive",
) => {
	const cs = template_variable.content.split("\n");
	const content = (
		await Promise.all(
			cs.map(async (text) => {
				text = await replaceAsync(
					text,
					/ @(\w+)/g,
					async (match: string, p1: string) => {
						return `${await hashToAt(p1)}`;
					},
				);

				if (text.startsWith("###")) {
					return `**${text.substring(3)}**`;
				}

				if (text.startsWith("*")) {
					return `&#45; ${text.substring(1)} ${await getAtToHash(text).catch(
						() => "",
					)}`;
				}

				return text;
			}),
		)
	).join("\n");
	template_variable.content = content;

	return createParam(type, template_id, template_variable);
};

export function createParam(
	type: string,
	template_id: string,
	template_variable: any = {},
) {
	if (type === "interactive") {
		return JSON.stringify({
			data: {
				template_id,
				template_variable,
			},
			type: "template",
		});
	} else {
		return JSON.stringify({
			data: {
				text: template_variable.content,
			},
			msg_type: "text",
		});
	}
}

// 通过 hash 获取 at
export async function getAtToHash(text: string) {
	const ats = text.match(/\(\[(\w+)\]\(/);
	let hash = "";
	if (ats) {
		hash = ats[1];
	} else {
		hash = text;
	}

	return await hashToAt(hash);
}

export async function hashToAt(
	hash: string,
	atTemp = (id: string) => `<at id="${id}"></at>`,
) {
	const commit = await simpleGit().show(hash);

	const emailMatch = commit.match(/<(.*)>/);

	if (!emailMatch) {
		return "";
	}

	const email = emailMatch[1];

	const res = await axios.get(BOT_SERVE + "/feishubot2/db");
	const bindGitMembers = res.data.bindGitMembers;
	const item = bindGitMembers.find((item: any) => item.gitEmail === email);
	if (!item) {
		return "";
	}

	return atTemp(item.feishuUserId);
}

export function replaceAsync(
	str: string,
	reg: RegExp,
	cb: (match: string, ...args: any[]) => Promise<string>,
) {
	const promises: Promise<string>[] = [];
	str.replace(reg, (match, ...args) => {
		promises.push(cb(match, ...args));
		return match;
	});
	return Promise.all(promises).then((replaces) => {
		return str.replace(reg, () => replaces.shift()!);
	});
}

export function parseVersion(title: string) {
	const res = title.match(/\d+\.\d+\.\d+/g);
	if (!res?.[0]) {
		throw new Error("版本号解析失败");
	}

	return res[0];
}
