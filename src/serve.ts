import { execFile, execFileSync } from "child_process";
import { Command } from "commander";
import Fastify from "fastify";
import { existsSync } from "fs";
import { exists } from "fs-extra";
import { join } from "path";
import { simpleGit } from "simple-git";

import {
	GITEA_REPO,
	GITEA_TOKEN,
	SERVE_PULL_REPO,
	SERVE_REPO,
} from "./config.js";
import { ServeDb as db } from "./db.js";
import { client } from "./feishuSdk.js";
import { createContent, createParam, parseVersion } from "./shared.js";
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
			let running = false;
			fastify.post("/feishubot2", async (request, reply) => {
				const body: any = request.body;
				console.log(JSON.stringify(body));

				if (body.challenge) {
					return body;
				}

				if (running) {
					console.log("繁忙");
					const receive_id =
						body?.open_chat_id || body?.event?.message?.chat_id;
					if (!receive_id) {
						return;
					}

					client.im.message.create({
						data: {
							content: JSON.stringify({
								text: `服务繁忙`,
							}),
							msg_type: "text",
							receive_id,
						},
						params: {
							receive_id_type: "chat_id",
						},
					});
					return;
				}

				running = true;

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
						running = false;
						return {
							code: 0,
						};
					} else if (cmd === "/getBinds") {
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
						running = false;
						return {
							code: 0,
						};
					} else {
						running = false;
						const branchIds = await getBranchNames(opts);
						const msgOb = await client.im.message.create({
							data: {
								content: createParam("interactive", "ctp_AAqkUf5ZjWgh", {
									branchs: branchIds
										.filter(
											(item) =>
												!item.startsWith("pre/") &&
												!item.startsWith("release/"),
										)
										.map((item: string) => ({
											text: item,
											value: item,
										})),
									// [
									// 	{
									// 		text: "develop",
									// 		value: 'develop',
									// 	}
									// ]
								}),
								msg_type: "interactive",
								receive_id: body.event.message.chat_id!,
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
						overflow_revert(opts, parseVersion(title), body.open_message_id);
					}

					running = false;
					return;
				} else if (hook === "button") {
					const action = body.action.value.action;
					if (action === "release") {
						// 一键发版
						button_release(opts)
							.then(() => {
								console.log("完成");
								// 回复
								running = false;
								client.im.message.create({
									data: {
										content: JSON.stringify({
											text: `<at user_id="${body.open_id}">TA</at> 请求一键发版成功`,
										}),
										msg_type: "text",
										receive_id: body.open_chat_id,
									},
									params: {
										receive_id_type: "chat_id",
									},
								});
							})
							.catch((err) => {
								running = false;
								client.im.message.create({
									data: {
										content: JSON.stringify({
											text: `<at user_id="${body.open_id}">TA</at> 请求一键发版失败，失败原因: ${err}`,
										}),
										msg_type: "text",
										receive_id: body.open_chat_id,
									},
									params: {
										receive_id_type: "chat_id",
									},
								});
							});
					}

					if (action === "pre") {
						// 生成二维码
						const robot =
							(db.data.bindGitMembers.findIndex(
								(item: any) => item.feishuUserId === body.open_id,
							) %
								30) +
							3;
						const formParam =
							db.data.msgMap[body.open_message_id + "_" + body.open_id] ?? {};
						button_pre(
							opts,
							String(robot),
							formParam.branch,
							formParam.envServer,
						)
							.then(() => {
								running = false;
								console.log("完成");
								// 回复
								client.im.message.create({
									data: {
										content: JSON.stringify({
											text: `<at user_id="${body.open_id}">TA</at> 请求生成二维码成功`,
										}),
										msg_type: "text",
										receive_id: body.open_chat_id,
									},
									params: {
										receive_id_type: "chat_id",
									},
								});
							})
							.catch((err) => {
								running = false;
								console.error(err);
								client.im.message.create({
									data: {
										content: JSON.stringify({
											text: `<at user_id="${body.open_id}">TA</at> 请求生成二维码失败，失败原因: ${err}`,
										}),
										msg_type: "text",
										receive_id: body.open_chat_id,
									},
									params: {
										receive_id_type: "chat_id",
									},
								});
							});
					}

					if (action === "dev") {
						// 生成二维码
						console.log("dev");
						console.log(
							db.data.msgMap[body.open_message_id + "_" + body.open_id],
						);
						running = false;
					}

					return;
				} else if (hook === "select_static") {
					running = false;
					const param = body.action.value;

					if (param.action === "form") {
						if (!db.data.msgMap) {
							db.data.msgMap = {};
						}

						db.data.msgMap[body.open_message_id + "_" + body.open_id] =
							Object.assign(
								{},
								db.data.msgMap[body.open_message_id + "_" + body.open_id],
								{
									[param.key]: body.action.option,
								},
							);
						await db.write();
					}

					return;
				}

				running = false;
				reply.send({ code: 0 });
			});

			fastify.get("/feishubot2/db", async () => {
				await db.read();
				return db.data;
			});
			fastify.post("/feishubot2/codeup", async (request, reply) => {
				console.log("codeup", request.body);
				fetchSync();
				return;
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

async function overflow_revert(opts: any, version: string, message_id: string) {
	await Promise.resolve();

	const repo = fetchRepo(opts);
	await repo.checkout("release/pro");
	await repo.pull("origin", "release/pro");
	try {
		await repo.checkoutBranch(`revert/v${version}`, "v" + version);
	} catch (error) {
		await repo.checkout(`revert/v${version}`);
	}

	// 空提交
	await repo.commit("revert: " + message_id, [], {
		"--allow-empty": true,
	} as any);

	const res = await repo.push("origin", `revert/v${version}`, ["-f"]);
	fetchSync();

	console.log("完成", version);
}

async function button_release(opts: any) {
	const repo = fetchRepo(opts);
	await repo.checkout(`release/pro`);
	await repo.pull("origin", "release/pro");
	await repo.merge([
		"origin/develop",
		"--no-ff",
		"--no-edit",
		"-m",
		"chore: merge develop -> release/pro",
	]);
	await repo.commit("build: release version", [], {
		"--allow-empty": true,
	} as any);
	const res = await repo.push("origin", `release/pro`);
	fetchSync();
}

async function button_pre(
	opts: any,
	robot: string,
	branch: string,
	envServer: string,
) {
	const repo = fetchRepo(opts);
	if (!branch) {
		branch = "develop";
	}

	if (!envServer) {
		envServer = "production";
	}

	const preBranchName = `pre/${branch.replace(/\//g, "-")}`;
	const originBranchName = `origin/${branch}`;

	console.log("[button_pre]", "fetch", branch, envServer, preBranchName);
	await repo.fetch("origin", branch);
	try {
		console.log("[button_pre]", "checkout", preBranchName);
		await repo.checkout(preBranchName);
	} catch (error) {
		console.log(
			"[button_pre]",
			"checkoutBranch",
			preBranchName,
			originBranchName,
		);
		await repo.checkoutBranch(preBranchName, originBranchName);
	}

	try {
		console.log("[button_pre]", "pull origin", preBranchName);
		await repo.pull("origin", preBranchName);
	} catch (err) {}

	console.log("[button_pre]", "merge", [
		originBranchName,
		"--no-ff",
		"--no-edit",
		"-m",
		`chore: merge ${branch} -> ${preBranchName}`,
	]);
	await repo.merge([
		originBranchName,
		"--no-ff",
		"--no-edit",
		"-m",
		`chore: merge ${branch} -> ${preBranchName}`,
	]);
	console.log(
		"[button_pre]",
		"commit",
		`build: robot=${robot},branch=${branch},envServer=${envServer}`,
	);
	await repo.commit(
		`build: robot=${robot},branch=${branch},envServer=${envServer}`,
		[],
		{
			"--allow-empty": true,
		} as any,
	);
	console.log("[button_pre]", "push", "origin", preBranchName);
	const res = await repo.push("origin", preBranchName);
	console.log("[button_pre]", "fetchSync");
	fetchSync();
}

function fetchRepo(opts: { clonePath: string; repo: string }) {
	const cwd = opts.clonePath;

	if (existsSync(join(cwd, ".git"))) {
		return simpleGit(cwd);
	} else {
		return simpleGit().clone(opts.repo, cwd);
	}
}

function fetchSync() {
	const [_, owner, repo] = GITEA_REPO.match(/\/\/.+?\/(.+?)\/(.+?)\./) || [];
	execFile("npx", [
		"gitea-cli",
		"sync",
		GITEA_REPO,
		"-t",
		GITEA_TOKEN,
		"-o",
		owner,
		"-r",
		repo,
	]);
}

async function getBranchNames(opts: any) {
	// 获取最新远程分支名
	const repo = fetchRepo(opts);
	await repo.fetch("origin");
	const res = await repo.branch(["-r"]);
	const branchIds = res.all
		.filter((item: string) => !item.startsWith("origin/HEAD"))
		.map((item: string) => item.replace("origin/", ""));
	return branchIds;
}
