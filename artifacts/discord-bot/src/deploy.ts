import { REST, Routes } from "discord.js";

import * as sprint from "./commands/sprint.js";
import * as join from "./commands/join.js";
import * as words from "./commands/words.js";
import * as leave from "./commands/leave.js";
import * as cancel from "./commands/cancel.js";
import * as end from "./commands/end.js";
import * as time from "./commands/time.js";
import * as status from "./commands/status.js";
import * as pb from "./commands/pb.js";
import * as stats from "./commands/stats.js";

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;

if (!DISCORD_TOKEN || !DISCORD_CLIENT_ID) {
  console.error("DISCORD_TOKEN and DISCORD_CLIENT_ID are required.");
  process.exit(1);
}

const commands = [sprint, join, words, leave, cancel, end, time, status, pb, stats].map(
  (cmd) => cmd.data.toJSON()
);

const rest = new REST().setToken(DISCORD_TOKEN);

console.log(`Registering ${commands.length} slash commands…`);

const result = await rest.put(Routes.applicationCommands(DISCORD_CLIENT_ID), {
  body: commands,
});

console.log(`✅ Successfully registered ${(result as unknown[]).length} application commands globally.`);
