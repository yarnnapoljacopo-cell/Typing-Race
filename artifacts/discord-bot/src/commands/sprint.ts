import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  TextChannel,
  PermissionFlagsBits,
} from "discord.js";
import { hasSprint, startSprint, SprintMode } from "../sprintManager.js";

export const data = new SlashCommandBuilder()
  .setName("sprint")
  .setDescription("Start a writing sprint in this channel")
  .addIntegerOption((o) =>
    o.setName("duration").setDescription("Sprint length in minutes (default: 15)").setMinValue(1).setMaxValue(180)
  )
  .addIntegerOption((o) =>
    o.setName("in").setDescription("Delay before sprint starts in minutes (default: 1)").setMinValue(0).setMaxValue(60)
  )
  .addIntegerOption((o) =>
    o.setName("at").setDescription("Start at a specific clock minute :mm (0-59)").setMinValue(0).setMaxValue(59)
  )
  .addStringOption((o) =>
    o
      .setName("mode")
      .setDescription("Sprint mode (default: regular)")
      .addChoices(
        { name: "regular — private writing, word count only", value: "regular" },
        { name: "open — everyone sees each other's text live", value: "open" },
        { name: "goal — race to a word target", value: "goal" }
      )
  )
  .addIntegerOption((o) =>
    o.setName("goal").setDescription("Word count goal for goal mode").setMinValue(1)
  )
  .addBooleanOption((o) =>
    o.setName("random").setDescription("Random duration between 10-25 minutes")
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild || !interaction.channel || !(interaction.channel instanceof TextChannel)) {
    await interaction.reply({ content: "This command can only be used in a server text channel.", ephemeral: true });
    return;
  }

  const guildId = interaction.guild.id;
  const channelId = interaction.channel.id;

  if (hasSprint(guildId, channelId)) {
    await interaction.reply({ content: "A sprint is already running in this channel! Use `/status` to see it.", ephemeral: true });
    return;
  }

  const isRandom = interaction.options.getBoolean("random") ?? false;
  const durationMinutes = isRandom
    ? Math.floor(Math.random() * 16) + 10
    : (interaction.options.getInteger("duration") ?? 15);

  let delayMinutes = interaction.options.getInteger("in") ?? 1;
  const atMinute = interaction.options.getInteger("at");

  if (atMinute !== null) {
    const now = new Date();
    const currentMinute = now.getMinutes();
    let minutesUntil = atMinute - currentMinute;
    if (minutesUntil <= 0) minutesUntil += 60;
    delayMinutes = minutesUntil;
  }

  const modeInput = interaction.options.getString("mode") as SprintMode | null;
  const goalInput = interaction.options.getInteger("goal");
  let mode: SprintMode = modeInput ?? "regular";
  let wordGoal: number | undefined;
  if (goalInput) {
    mode = "goal";
    wordGoal = goalInput;
  }

  const appBaseUrl = process.env.API_BASE_URL?.replace(/\/$/, "") ?? "";

  await interaction.deferReply({ ephemeral: true });

  try {
    await startSprint({
      client: interaction.client,
      guildId,
      channelId,
      channel: interaction.channel,
      creatorDiscordId: interaction.user.id,
      durationMinutes,
      delayMinutes,
      mode,
      wordGoal,
      appBaseUrl,
    });
    await interaction.editReply({ content: `Sprint created! I've posted the announcement in this channel.` });
  } catch (err) {
    await interaction.editReply({ content: `Failed to create sprint: ${String(err)}` });
  }
}
