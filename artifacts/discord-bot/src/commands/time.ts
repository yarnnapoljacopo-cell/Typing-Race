import { SlashCommandBuilder, ChatInputCommandInteraction, TextChannel } from "discord.js";
import { getSprint, hasSprint } from "../sprintManager.js";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

export const data = new SlashCommandBuilder()
  .setName("time")
  .setDescription("Show how much time is left in the current sprint");

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

  if (sprint.status === "joining") {
    const joinedAt = sprint.sprintStartedAt;
    await interaction.reply({ content: `⏳ Sprint hasn't started yet — waiting for participants. Start delay: ${sprint.delayMinutes} min.`, ephemeral: true });
    return;
  }

  if (sprint.status === "collecting") {
    await interaction.reply({ content: `⏱️ The sprint has ended — waiting for word count submissions (\`/words\`).`, ephemeral: true });
    return;
  }

  if (sprint.status === "done") {
    await interaction.reply({ content: `The sprint is done.`, ephemeral: true });
    return;
  }

  if (!sprint.sprintStartedAt) {
    await interaction.reply({ content: `Sprint is starting soon!`, ephemeral: true });
    return;
  }

  const elapsedMs = Date.now() - sprint.sprintStartedAt;
  const totalMs = sprint.durationMinutes * 60 * 1000;
  const remainingMs = Math.max(0, totalMs - elapsedMs);
  const remainingSeconds = Math.ceil(remainingMs / 1000);

  await interaction.reply({
    content: `⏰ **${formatTime(remainingSeconds)}** remaining in the sprint.`,
    ephemeral: true,
  });
}
