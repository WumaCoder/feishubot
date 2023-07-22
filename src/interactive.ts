import { Command } from "commander";

import { CliDb } from "./db.js";
import { client } from "./feishuSdk.js";
import { next } from "./loading.js";
import { createContent, parseBtns } from "./shared.js";

const STATUS = {
	err: "❌",
	ok: "✅",
	start: "#",
};

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
		.option("--status <string>", "状态, none, start, loading, ok, err", "none")
		.action(interactivePut);
	async function interactivePut(opts: any) {
		await CliDb.read();
		const tempJson = CliDb.data;
		opts = Object.assign({}, tempJson.opts, opts);
		console.log(opts, tempJson);
		const status = opts?.status as "err" | "none" | "ok" | "start";
		if (opts.status === "loading") {
			CliDb.data.loading++;
			await CliDb.write();
		}

		for (const msgId of tempJson.msgIds) {
			await client.im.message.patch({
				data: {
					content: await createContent(
						opts,
						status === "none"
							? ""
							: (CliDb.data.loading > -1
									? next(CliDb.data.loading)
									: STATUS[status] || "") + " ",
					),
				},
				path: {
					message_id: msgId,
				},
			});
		}
	}

	interactive
		.command("close")
		.description("关闭一个消息")
		.option("--title <string>") // title
		.option("--content <string>") // content
		.option("--template_id <string>") // template_id
		.option("--foot_text <string>") // foot_text
		.option("--btns <string...>") // btns
		.option("--content_head <string>", "content head") // btns
		.option("--content_foot <string>", "content foot") // btns
		.option("--status <string>", "状态, none, start, loading, ok, err", "none")
		.action(async function (opts) {
			// 最后调用一次 put
			await interactivePut(opts);
			CliDb.data.msgIds = [];
			CliDb.data.opts = {};
			CliDb.data.loading = -1;
			await CliDb.write();
		});
};
