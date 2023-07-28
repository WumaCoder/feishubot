import { Command } from "commander";

import { CliDb } from "./db.js";
import { client } from "./feishuSdk.js";
import { next } from "./loading.js";
import { createContent, parseBtns } from "./shared.js";

const STATUS = {
	err: "❌",
	ok: "✅",
	start: "🎈",
};

export default (interactive: Command) => {
	interactive
		.command("push")
		.description("发送或者回复一个消息")
		.option("--id <string>", "用来区分隔离不同消息会话", "default")
		.option("--type <string>", "消息类型, interactive | text", "interactive") // title
		.option("--title <string>") // title
		.option("--content <string>") // content
		.option("--template_id <string>") // template_id
		.option("--foot_text <string>") // foot_text
		.option("--btns <string...>") // btns
		.option("--content_head <string>", "content head", "") // btns
		.option("--content_foot <string>", "content foot", "") // btns
		.option("--message_id <string>", "要回复的消息ID") // btns
		.action(async function (opts) {
			const id = opts.id;
			const msg_type = opts.type;
			opts.btns = parseBtns(opts.btns);
			const msgIds = [];
			if (opts.message_id) {
				opts.message_id = opts.message_id.replace(/\s/g, "");
			}

			if (opts.message_id) {
				// 走回复消息模式
				const msgOb = await client.im.message.reply({
					data: {
						content: await createContent(opts, msg_type),
						msg_type,
					},
					path: {
						message_id: opts.message_id,
					},
				});
				if (msgOb.data!.message_id) {
					msgIds.push(msgOb.data!.message_id);
				}
			} else {
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
						if (chat.description?.includes("--disabled-push")) {
							continue;
						}

						if (!chat.description?.includes(`--accept-${opts.template_id}`)) {
							continue;
						}

						const msgOb = await client.im.message.create({
							data: {
								content: await createContent(opts, msg_type),
								msg_type,
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
			}

			CliDb.data.session[id] = {
				loading: -1,
				msgIds,
				opts,
			};
			await CliDb.write();
		});

	interactive
		.command("put")
		.description("更新一个消息")
		.option("--id <string>", "用来区分隔离不同消息会话", "default")
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
		const tempJson = CliDb.data.session[opts.id];
		opts = Object.assign({}, tempJson.opts, opts);
		console.log(opts, tempJson);
		const status = opts?.status as "err" | "loading" | "none" | "ok" | "start";
		if (opts.status === "loading") {
			tempJson.loading++;
			await CliDb.write();
		}

		if (status !== "none" && opts.foot_text) {
			opts.foot_text = `${
				(status === "loading" ? next(tempJson.loading) : STATUS[status] || "") +
				" "
			} ${opts.foot_text}`;
		}

		for (const msgId of tempJson.msgIds) {
			await client.im.message.patch({
				data: {
					content: await createContent(opts, opts.type),
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
		.option("--id <string>", "用来区分隔离不同消息会话", "default")
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
			const id = opts.id;
			await interactivePut(opts);
			delete CliDb.data.session[id];
			await CliDb.write();
		});
};
