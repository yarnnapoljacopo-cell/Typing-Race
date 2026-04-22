import { SlashCommandBuilder, ChatInputCommandInteraction, TextChannel } from "discord.js";
import { getStats } from "../statsStore.js";

export const data = new SlashCommandBuilder()
  .setName("stats")
  .setDescription("Show sprint stats for yourself or another user")
  .addUserOption((o) =>
    o.setName("user").setDescription("The user to look up (defaults to you)")
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
    return;
  }

  const target = interaction.options.getUser("user") ?? interaction.user;
  const stats = getStats(interaction.guild.id, target.id);

  const displayName = target.displayName || target.username;

  if (!stats || stats.totalSprints === 0) {
    await interaction.reply({
      content: `**${displayName}** hasn't completed any sprints yet.`,
      ephemeral: true,
    });
    return;
  }

  const avgWpm = stats.totalMinutes > 0
    ? Math.round(stats.totalWords / stats.totalMinutes)
    : 0;
  const avgWords = Math.round(stats.totalWords / stats.totalSprints);

  await interaction.reply({
    content:
      `📊 **Sprint Stats for ${displayName}**\n` +
      `**Total sprints:** ${stats.totalSprints}\n` +
      `**Total words:** ${stats.totalWords.toLocaleString()}\n` +
      `**Average words/sprint:** ${avgWords.toLocaleString()}\n` +
      `**Average WPM:** ${avgWpm}\n` +
      `**Personal best:** ${stats.pb.toLocaleString()} words (${stats.pbDate})`,
    ephemeral: true,
  });
}
