import * as commander from "commander";

import interactiveCmd from "./interactive.js";
import serveCmd from "./serve.js";

const program = new commander.Command("feishu bot");

program.version("0.0.20");

const interactive = program.command("interactive");
interactiveCmd(interactive);

const serve = program.command("serve");
serveCmd(serve);

await program.parseAsync();
