import { Command } from "commander";
import Fastify from "fastify";

import db from "./db.js";
import { client } from "./feishuSdk.js";
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

				if (body.challenge) {
					return body;
				}

				const content = JSON.parse(body.event.message.content);
				// console.log(content);
				const text = content.text;
				const args = text.split(" ").filter((item: string) => item);

				// console.log(args);

				await db.read();
				// console.log(JSON.stringify(body));

				const [hook, cmd, ...argsv] = [
					body.header.event_type,
					...args.slice(1),
				];

				if (hook === "im.message.receive_v1") {
					if (cmd === "/bind") {
						const [email] = argsv;
						const temail = email.match(/\[(.*)\]/)?.[1] ?? email;
						console.log(email, temail);

						const item = db.data.bindGitMembers.find(
							(item) =>
								item.feishuUserId === body.event.sender.sender_id.open_id,
						);
						if (item) {
							item.gitEmail = temail;
						} else {
							db.data.bindGitMembers.push({
								feishuUserId: body.event.sender.sender_id.open_id,
								gitEmail: temail,
							});
						}

						await client.im.message.create({
							data: {
								content: JSON.stringify({
									text: `<at user_id="${body.event.sender.sender_id.open_id}">Tom</at> 绑定成功，你的邮箱是 ${temail}`,
								}),
								msg_type: "text",
								receive_id: body.event.message.chat_id,
							},
							params: {
								receive_id_type: "chat_id",
							},
						});

						await db.write();
					}
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
