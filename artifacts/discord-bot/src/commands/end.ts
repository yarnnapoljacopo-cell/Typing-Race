import { SlashCommandBuilder, ChatInputCommandInteraction, TextChannel, PermissionFlagsBits, GuildMember } from "discord.js";
import { getSprint, hasSprint, endSprintEarly } from "../sprintManager.js";

function hasMcRole(interaction: ChatInputCommandInteraction): boolean {
  const member = interaction.member;
  if (!member || !(member instanceof GuildMember)) return false;
  const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);
  const hasMc = member.roles.cache.some((r) => r.name === "Sprint MC");
  return isAdmin || hasMc;
}

export const data = new SlashCommandBuilder()
  .setName("end")
  .setDescription("End the sprint early (creator or Sprint MC only)");

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
    await interaction.reply({ content: "Only the sprint creator or someone with the Sprint MC role can end the sprint early.", ephemeral: true });
    return;
  }

  await interaction.reply("🛑 **Sprint ended early.** Collecting final word counts…");

  await endSprintEarly(sprint, interaction.channel as TextChannel);
}
