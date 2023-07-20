import untildify from "untildify";

export const TEMP_FILE = untildify("~/.feishu-bot/temp.json");
export const DB_FILE = untildify("~/.feishu-bot/db.json");

export const BOT_APPID = process.env.BOT_APPID!;
export const BOT_APPSECRET = process.env.BOT_APPSECRET!;
