import {
  Client,
  GatewayIntentBits,
  Events,
  Collection,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
} from "discord.js";

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
if (!DISCORD_TOKEN) {
  console.error("DISCORD_TOKEN environment variable is required.");
  process.exit(1);
}

type Command = {
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
};

const commands = new Collection<string, Command>();

const allCommands: Command[] = [sprint, join, words, leave, cancel, end, time, status, pb, stats];

for (const cmd of allCommands) {
  commands.set(cmd.data.name, cmd);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ],
});

client.once(Events.ClientReady, (c) => {
  console.log(`✅ Writing Sprint Bot is online as ${c.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);
  if (!command) {
    console.warn(`Unknown command: ${interaction.commandName}`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(`Error executing /${interaction.commandName}:`, err);
    const msg = { content: "Something went wrong. Please try again.", ephemeral: true };
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(msg).catch(() => undefined);
    } else {
      await interaction.reply(msg).catch(() => undefined);
    }
  }
});

await client.login(DISCORD_TOKEN);
