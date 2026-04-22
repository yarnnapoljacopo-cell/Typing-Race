import { SlashCommandBuilder, ChatInputCommandInteraction, TextChannel } from "discord.js";
import { getSprint, hasSprint, submitWords } from "../sprintManager.js";

export const data = new SlashCommandBuilder()
  .setName("words")
  .setDescription("Submit your word count at the end of a sprint")
  .addStringOption((o) =>
    o
      .setName("count")
      .setDescription("Final word count (e.g. 1642) or words written with + (e.g. +342)")
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild || !interaction.channel || !(interaction.channel instanceof TextChannel)) {
    await interaction.reply({ content: "This command can only be used in a server text channel.", ephemeral: true });
    return;
  }

  const guildId = interaction.guild.id;
  const channelId = interaction.channel.id;

  if (!hasSprint(guildId, channelId)) {
    await interaction.reply({ content: "There's no active sprint in this channel.", ephemeral: true });
    return;
  }

  const sprint = getSprint(guildId, channelId)!;

  if (sprint.status !== "collecting" && sprint.status !== "running") {
    await interaction.reply({ content: "Word count submissions are not open right now.", ephemeral: true });
    return;
  }

  const discordId = interaction.user.id;
  const username = interaction.user.displayName || interaction.user.username;

  if (!sprint.participants.has(discordId)) {
    sprint.participants.set(discordId, { discordId, username, startingWords: 0 });
  }

  const raw = interaction.options.getString("count", true).trim();
  let finalWords: number | undefined;
  let wordsWritten: number | undefined;

  if (raw.startsWith("+")) {
    const n = parseInt(raw.slice(1), 10);
    if (isNaN(n) || n < 0) {
      await interaction.reply({ content: "Invalid word count. Use a number like `+342`.", ephemeral: true });
      return;
    }
    wordsWritten = n;
  } else {
    const n = parseInt(raw, 10);
    if (isNaN(n) || n < 0) {
      await interaction.reply({ content: "Invalid word count. Use a number like `1642` or `+342`.", ephemeral: true });
      return;
    }
    finalWords = n;
  }

  await submitWords(sprint, discordId, finalWords ?? 0, wordsWritten);

  const participant = sprint.participants.get(discordId)!;
  const written = Math.max(0, (participant.finalWords ?? 0) - participant.startingWords);
  const wpm = sprint.durationMinutes > 0 ? Math.round(written / sprint.durationMinutes) : 0;

  await interaction.reply({
    content: `✅ **${written.toLocaleString()} words** recorded for ${username} (${wpm} WPM). Great work!`,
  });
}
