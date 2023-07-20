import * as commander from "commander";

import interactiveCmd from "./interactive";
import serveCmd from "./serve";

const program = new commander.Command("feishu bot");

const interactive = program.command("interactive");
interactiveCmd(interactive);

const serve = program.command("serve");
serveCmd(serve);

await program.parseAsync();
