import { Command } from "commander";
import Fastify from "fastify";
const fastify = Fastify({
	logger: true,
});

export default (program: Command) => {
	const serve = program
		.command("serve")
		.option(`--port <number>`, `端口号`, "3000")
		.description("飞书机器人后端服务")
		.action(function (opts) {
			fastify.post("/feishubot2", async (request, reply) => {
				const body: any = request.body;

				if (body.header.event_type === "im.message.receive_v1") {
					const content = JSON.parse(body.event.message.content);
					console.log(content);
					const text = content.text;
				}

				console.log(body);

				reply.send({ ok: true });
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
