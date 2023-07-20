import * as lark from "@larksuiteoapi/node-sdk";
import * as commander from "commander";
import fs from "fs-extra";
import untildify from "untildify";

const TEMP_FILE = untildify("~/.feishu-bot/temp.json");

const program = new commander.Command("feishu bot");

const BOT_APPID = process.env.BOT_APPID!;
const BOT_APPSECRET = process.env.BOT_APPSECRET!;

const client = new lark.Client({
	appId: BOT_APPID,
	appSecret: BOT_APPSECRET,
	appType: lark.AppType.SelfBuild,
	domain: lark.Domain.Feishu,
});

const createContent = ({
	template_id,
	...template_variable
}: {
	btns: any;
	content: string;
	foot_text: string;
	template_id: string;
	title: string;
}) => {
	return JSON.stringify({
		data: {
			template_id,
			template_variable,
		},
		type: "template",
	});
};

// `{"type": "template", "data": { "template_id": "${opts.template_id}", "template_variable": {"title": "${opts.title}", "content": "${opts.content}","foot_text": "${foot_text}", "btns": [{"text":"下载sourceMap","value":"sourcemap"}]} } }`;
const interactive = program.command("interactive");
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

await program.parseAsync();

function parseBtns(btns: string[]) {
	return btns.map((item) => {
		const [text, value] = item.split(":");
		return { text, value };
	});
}
