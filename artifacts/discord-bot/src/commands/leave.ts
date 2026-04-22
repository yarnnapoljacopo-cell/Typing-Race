import { SlashCommandBuilder, ChatInputCommandInteraction, TextChannel } from "discord.js";
import { getSprint, hasSprint } from "../sprintManager.js";

export const data = new SlashCommandBuilder()
  .setName("leave")
  .setDescription("Leave the current sprint");

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

  if (sprint.status === "collecting" || sprint.status === "done") {
    await interaction.reply({ content: "The sprint has already ended. Submit your words with `/words`.", ephemeral: true });
    return;
  }

  const discordId = interaction.user.id;

  if (!sprint.participants.has(discordId)) {
    await interaction.reply({ content: "You're not in this sprint.", ephemeral: true });
    return;
  }

  sprint.participants.delete(discordId);
  await interaction.reply({ content: "You've left the sprint. Hope to see you next time! ✍️", ephemeral: true });
}
