import { SlashCommandBuilder, ChatInputCommandInteraction, TextChannel } from "discord.js";
import { getStats } from "../statsStore.js";

export const data = new SlashCommandBuilder()
  .setName("pb")
  .setDescription("Show your personal best sprint (most words written in a single sprint)");

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
    return;
  }

  const stats = getStats(interaction.guild.id, interaction.user.id);
  if (!stats || stats.pb === 0) {
    await interaction.reply({
      content: `You haven't completed any sprints yet! Join one with \`/sprint\`.`,
      ephemeral: true,
    });
    return;
  }

  const avgWpm = stats.totalMinutes > 0
    ? Math.round(stats.totalWords / stats.totalMinutes)
    : 0;

  await interaction.reply({
    content:
      `🏆 **Personal Best for ${interaction.user.displayName || interaction.user.username}**\n` +
      `**Best sprint:** ${stats.pb.toLocaleString()} words (on ${stats.pbDate})\n` +
      `**Total sprints:** ${stats.totalSprints}\n` +
      `**Total words:** ${stats.totalWords.toLocaleString()}\n` +
      `**Average WPM:** ${avgWpm}`,
    ephemeral: true,
  });
}
