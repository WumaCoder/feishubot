import { describe, expect, it } from "vitest";

import { getAtToHash, replaceAsync } from "./shared.js";

describe("shared.ts", () => {
	// it("getAtToHash", async () => {
	// 	// TODO
	// 	expect(
	// 		await getAtToHash(
	// 			`* 测试 ([e3594de62239393a0e5b48ef239c0921e6e11b9a](https://codeup.aliyun.com/5ee5b627f0e06f96cfd22d38/welife001_xgj/teacher/commit/ecc753605bfe8e8e2a573afd8ce619a500be6c0c))`,
	// 		),
	// 	).toBe(`<at id="ou_c3a8aee7024bf87a3087459dc4fe7f1a"></at>`);
	// });

	it("replaceAsync", async () => {
		const t = `## hekko @1111\nfesgsfesf @222 @3333@xxx`;

		expect(
			await replaceAsync(t, / @(\w+)/g, async (match: string, p1: string) => {
				return ` <${p1}>`;
			}),
		).toBe(`## hekko <1111>\nfesgsfesf <222> <3333>@xxx`);
	});
});
