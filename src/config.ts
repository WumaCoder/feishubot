import untildify from "untildify";

export const CLI_DB_FILE = untildify("~/.feishu-bot/cli.json");
export const SERVE_DB_FILE = untildify("~/.feishu-bot/db.json");

export const BOT_APPID = process.env.BOT_APPID!;
export const BOT_APPSECRET = process.env.BOT_APPSECRET!;
