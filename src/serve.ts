import { Command } from "commander";
import Fastify from "fastify";

import db from "./db.js";
const fastify = Fastify({
	logger: true,
});

export default (program: Command) => {
	const serve = program
		.option(`--port <number>`, `端口号`, "3000")
		.description("飞书机器人后端服务")
		.action(function (opts) {
			fastify.post("/feishubot2", async (request, reply) => {
				const body: any = request.body;

				const content = JSON.parse(body.event.message.content);
				// console.log(content);
				const text = content.text;
				const args = text.split(" ").filter((item: string) => item);
				// console.log(args);

				await db.read();

				const action = new Command();
				const data: string[] = [];
				action.configureOutput({
					// 此处使输出变得容易区分
					writeErr: (str) => data.push(`[ERR] ${str}`),
					writeOut: (str) => data.push(`${str}`),
				});
				const im_message_receive_v1 = action.command("im.message.receive_v1");
				im_message_receive_v1
					.command("/bind", "绑定git账号")
					.argument("<string>", "git email")
					.action(async (email) => {
						const item = db.data.bindGitMembers.find(
							(item) =>
								item.feishuUserId === body.event.sender.sender_id.open_id,
						);
						if (item) {
							item.gitEmail = email;
						} else {
							db.data.bindGitMembers.push({
								feishuUserId: body.event.sender.sender_id.open_id,
								gitEmail: email,
							});
						}

						await db.write();
					});
				try {
					action.exitOverride();
					await action.parseAsync([body.header.event_type, ...args]);
				} catch (error: any) {
					return {
						code: error.exitCode || 2,
						data: data.join("\n"),
						msg: String(error?.message),
					};
				}

				reply.send({ code: 0 });
			});

			fastify.get("/feishubot2/db", async () => {
				await db.read();
				return db.data;
			});

			fastify.listen({ port: opts.port }, (err, address) => {
				if (err) {
					throw err;
				}

				// Server is now listening on ${address}
				console.log(`Server is now listening on ${address}`);
			});
		});
};
