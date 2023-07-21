import axios from "axios";
import { CleanOptions, simpleGit } from "simple-git";

import { BOT_SERVE } from "./config.js";

export function parseBtns(btns: string[]) {
	return btns.map((item) => {
		const [text, value] = item.split(":");
		return { text, value };
	});
}

export const createContent = async ({
	template_id,
	...template_variable
}: {
	btns: any;
	content: string;
	foot_text: string;
	template_id: string;
	title: string;
}) => {
	const cs = template_variable.content.split("\n");
	const content = (
		await Promise.all(
			cs.map(async (text) => {
				if (text.startsWith("###")) {
					return `**${text.substring(3)}**`;
				}

				if (text.startsWith("*")) {
					return ` &#45; ${text.substring(1)} ${await getAtToHash(text)}`;
				}

				return text;
			}),
		)
	).join("\n");
	template_variable.content = content;

	// const commit = await simpleGit().log();

	// const emailMatch = commit.match(/<(.*)>/);

	// if (!emailMatch) {
	// 	return "";
	// }

	// const email = emailMatch[1];

	// const pushAtText = await hashToAt(template_variable.content);

	return JSON.stringify({
		data: {
			template_id,
			template_variable,
		},
		type: "template",
	});
};

// 通过 hash 获取 at
export async function getAtToHash(text: string) {
	const ats = text.match(/\(\[(\w+)\]\(/);
	if (!ats) {
		return "";
	}

	const hash = ats[1];

	return await hashToAt(hash);
}

export async function hashToAt(hash: string) {
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

	return `<at id="${item.feishuUserId}"></at>`;
}
