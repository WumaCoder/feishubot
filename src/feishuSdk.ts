import * as lark from "@larksuiteoapi/node-sdk";

import { BOT_APPID, BOT_APPSECRET } from "./config";

export const client = new lark.Client({
	appId: BOT_APPID,
	appSecret: BOT_APPSECRET,
	appType: lark.AppType.SelfBuild,
	domain: lark.Domain.Feishu,
});
