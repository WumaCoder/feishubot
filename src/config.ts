import untildify from "untildify";

export const CLI_DB_FILE = untildify("~/.feishu-bot/cli.json");
export const SERVE_DB_FILE = untildify("~/.feishu-bot/db.json");
export const SERVE_REPO = untildify("~/.feishu-bot/repo");

export const BOT_APPID = process.env.BOT_APPID!;
export const BOT_APPSECRET = process.env.BOT_APPSECRET!;
export const BOT_SERVE = process.env.BOT_SERVE!;
export const SERVE_PULL_REPO = process.env.SERVE_PULL_REPO!;
