import { SlashCommandBuilder, ChatInputCommandInteraction, TextChannel, PermissionFlagsBits, GuildMember } from "discord.js";
import { getSprint, hasSprint, removeSprint } from "../sprintManager.js";

function hasMcRole(interaction: ChatInputCommandInteraction): boolean {
  const member = interaction.member;
  if (!member || !(member instanceof GuildMember)) return false;
  const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);
  const hasMc = member.roles.cache.some((r) => r.name === "Sprint MC");
  return isAdmin || hasMc;
}

export const data = new SlashCommandBuilder()
  .setName("cancel")
  .setDescription("Cancel the sprint before it starts (creator or Sprint MC only)");

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

  const isCreator = sprint.creatorDiscordId === interaction.user.id;
  const isMc = hasMcRole(interaction);

  if (!isCreator && !isMc) {
    await interaction.reply({ content: "Only the sprint creator or someone with the Sprint MC role can cancel the sprint.", ephemeral: true });
    return;
  }

  if (sprint.status === "running") {
    await interaction.reply({ content: "The sprint is already running! Use `/end` to end it early instead.", ephemeral: true });
    return;
  }

  removeSprint(guildId, channelId);
  await interaction.reply("❌ **Sprint cancelled.** Better luck next time!");
}
