import { Command } from "commander";
import fs from "fs-extra";

import { TEMP_FILE } from "./config";
import { client } from "./feishuSdk";
import { createContent, parseBtns } from "./shared";

export default (interactive: Command) => {
	interactive
		.command("push")
		.description("发送一个消息")
		.option("--title <string>") // title
		.option("--content <string>") // content
		.option("--template_id <string>") // template_id
		.option("--foot_text <string>") // foot_text
		.option("--btns <string...>") // btns
		.action(async function (opts) {
			opts.btns = parseBtns(opts.btns);
			const msgIds = [];
			for await (const item of await client.im.chat.listWithIterator({
				params: {
					page_size: 20,
					sort_type: "ByCreateTimeAsc",
				},
			})) {
				if (!item?.items) {
					continue;
				}

				for (const chat of item.items) {
					const msgOb = await client.im.message.create({
						data: {
							content: createContent(opts),
							msg_type: "interactive",
							receive_id: chat.chat_id!,
						},
						params: {
							receive_id_type: "chat_id",
						},
					});
					msgIds.push(msgOb.data!.message_id);
				}
			}

			await fs.ensureFile(TEMP_FILE);
			await fs.writeFile(TEMP_FILE, JSON.stringify({ msgIds, opts }));
		});

	interactive
		.command("put")
		.description("更新一个消息")
		.option("--title <string>") // title
		.option("--content <string>") // content
		.option("--template_id <string>") // template_id
		.option("--foot_text <string>") // foot_text
		.option("--btns <string...>") // btns
		.action(async function (opts) {
			const tempJson = JSON.parse(fs.readFileSync(TEMP_FILE).toString());
			opts = Object.assign({}, tempJson.opts, opts);
			console.log(opts, tempJson);

			for (const msgId of tempJson.msgIds) {
				await client.im.message.patch({
					data: {
						content: createContent(opts),
					},
					path: {
						message_id: msgId,
					},
				});
			}
		});

	interactive
		.command("close")
		.description("关闭一个消息")
		.action(async function () {
			await fs.remove(TEMP_FILE);
		});
};
