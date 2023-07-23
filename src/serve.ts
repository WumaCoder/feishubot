import { execFile, execFileSync } from "child_process";
import { Command } from "commander";
import Fastify from "fastify";
import { exists } from "fs-extra";
import { join } from "path";
import { simpleGit } from "simple-git";

import { SERVE_PULL_REPO, SERVE_REPO } from "./config.js";
import { ServeDb as db } from "./db.js";
import { client } from "./feishuSdk.js";
import { parseVersion } from "./shared.js";
const fastify = Fastify({
	logger: true,
});

export default (program: Command) => {
	const serve = program
		.option(`--port <number>`, `端口号`, "3000")
		.option(`--repo <string>`, `克隆的参考链接`, SERVE_PULL_REPO)
		.option(`--clone-path <string>`, `克隆到什么位置`, SERVE_REPO)
		.description("飞书机器人后端服务")
		.action(function (opts) {
			fastify.post("/feishubot2", async (request, reply) => {
				const body: any = request.body;
				console.log(JSON.stringify(body));

				if (body.challenge) {
					return body;
				}

				await db.read();
				const hook = body?.header?.event_type ?? body?.action?.tag;

				if (hook === "im.message.receive_v1") {
					const content = JSON.parse(body.event.message.content);
					// console.log(content);
					const text = content.text;
					const args = text.split(" ").filter((item: string) => item);

					// console.log(args);
					const [cmd, ...argsv] = [...args.slice(1)];
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
						return {
							code: 0,
						};
					}

					if (cmd === "/getBinds") {
						await client.im.message.create({
							data: {
								content: JSON.stringify({
									text: `以下是查询结果：\n${db.data.bindGitMembers
										.map(
											(item) =>
												`email: ${item.gitEmail}, feishuUserId: ${item.feishuUserId}`,
										)
										.join("\n")}`,
								}),
								msg_type: "text",
								receive_id: body.event.message.chat_id,
							},
							params: {
								receive_id_type: "chat_id",
							},
						});
						return {
							code: 0,
						};
					}
				} else if (hook === "overflow") {
					const option = body.action.option;
					if (option === "revert") {
						const title = body?.action?.value?.title as string;
						overflow_revert(opts, parseVersion(title));
					}

					return;
				}

				reply.send({ code: 0 });
			});

			fastify.get("/feishubot2/db", async () => {
				await db.read();
				return db.data;
			});

			fastify.listen({ host: "0.0.0.0", port: opts.port }, (err, address) => {
				if (err) {
					throw err;
				}

				// Server is now listening on ${address}
				console.log(`Server is now listening on ${address}`);
			});
		});
};

async function overflow_revert(opts: any, version: string) {
	await Promise.resolve();
	const cwd = opts.clonePath;
	console.log(opts, version);

	// execFile("npx", ["gitea-cli", "origin", "pull", cwd, "-r", opts.repo]);

	if (await exists(join(cwd, ".git"))) {
		const repo = simpleGit(cwd);
		await repo.checkout("release/pro");
		await repo.pull();
		try {
			await repo.checkoutBranch(`revert/v${version}`, "v" + version);
		} catch (error) {
			await repo.checkout(`revert/v${version}`);
		}

		const res = await repo.push("origin", `revert/v${version}`, ["-f"]);
		console.log(res);
	} else {
		const res = await simpleGit(cwd)
			.clone(opts.repo, cwd)
			.checkout("release/pro")
			.checkoutBranch(`revert/v${version}`, "v" + version)
			.push("origin", `revert/v${version}`, ["-f"]);
		console.log(res);
	}

	// npx gitea-cli sync http://localhost:3000/wumacoder/teacher.git -t c54b63fc071283de5d00f51790a17c11e88e75b8 -o wumacoder -r teacher
	execFile("npx", [
		"gitea-cli",
		"sync",
		"http://localhost:3000/wumacoder/teacher.git",
		"-t",
		"c54b63fc071283de5d00f51790a17c11e88e75b8",
		"-o",
		"wumacoder",
		"-r",
		"teacher",
	]);

	console.log("完成", version);
}
