import { Command } from "commander";
import fs from "fs-extra";

import { CliDb } from "./db.js";
import { client } from "./feishuSdk.js";
import { createContent, parseBtns } from "./shared.js";

export default (interactive: Command) => {
	interactive
		.command("push")
		.description("发送一个消息")
		.option("--title <string>") // title
		.option("--content <string>") // content
		.option("--template_id <string>") // template_id
		.option("--foot_text <string>") // foot_text
		.option("--btns <string...>") // btns
		.option("--content_head <string>", "content head", "") // btns
		.option("--content_foot <string>", "content foot", "") // btns
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
					if (
						chat.description?.includes("--console") &&
						chat.description.includes("--disabled-push")
					) {
						continue;
					}

					const msgOb = await client.im.message.create({
						data: {
							content: await createContent(opts),
							msg_type: "interactive",
							receive_id: chat.chat_id!,
						},
						params: {
							receive_id_type: "chat_id",
						},
					});
					if (msgOb.data!.message_id) {
						msgIds.push(msgOb.data!.message_id);
					}
				}
			}

			await CliDb.read();
			CliDb.data.msgIds = msgIds;
			CliDb.data.opts = opts;
			await CliDb.write();
		});

	interactive
		.command("put")
		.description("更新一个消息")
		.option("--title <string>") // title
		.option("--content <string>") // content
		.option("--template_id <string>") // template_id
		.option("--foot_text <string>") // foot_text
		.option("--btns <string...>") // btns
		.option("--content_head <string>", "content head") // btns
		.option("--content_foot <string>", "content foot") // btns
		.action(async function (opts) {
			await CliDb.read();
			const tempJson = CliDb.data;
			opts = Object.assign({}, tempJson.opts, opts);
			console.log(opts, tempJson);

			for (const msgId of tempJson.msgIds) {
				await client.im.message.patch({
					data: {
						content: await createContent(opts),
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
			CliDb.data.msgIds = [];
			CliDb.data.opts = {};
			await CliDb.write();
		});
};
