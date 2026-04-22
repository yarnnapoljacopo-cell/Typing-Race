import { SlashCommandBuilder, ChatInputCommandInteraction, TextChannel } from "discord.js";
import { getSprint, hasSprint } from "../sprintManager.js";

export const data = new SlashCommandBuilder()
  .setName("join")
  .setDescription("Join the active sprint in this channel")
  .addIntegerOption((o) =>
    o.setName("startingwords").setDescription("Your current word count before the sprint (default: 0)").setMinValue(0)
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild || !interaction.channel || !(interaction.channel instanceof TextChannel)) {
    await interaction.reply({ content: "This command can only be used in a server text channel.", ephemeral: true });
    return;
  }

  const guildId = interaction.guild.id;
  const channelId = interaction.channel.id;

  if (!hasSprint(guildId, channelId)) {
    await interaction.reply({ content: "There's no active sprint in this channel. Start one with `/sprint`.", ephemeral: true });
    return;
  }

  const sprint = getSprint(guildId, channelId)!;

  if (sprint.status === "running" || sprint.status === "collecting") {
    await interaction.reply({ content: "The sprint has already started! You can still join via the website.", ephemeral: true });
    return;
  }

  const discordId = interaction.user.id;
  const username = interaction.user.displayName || interaction.user.username;

  if (sprint.participants.has(discordId)) {
    await interaction.reply({ content: "You're already in this sprint!", ephemeral: true });
    return;
  }

  const startingWords = interaction.options.getInteger("startingwords") ?? 0;
  sprint.participants.set(discordId, { discordId, username, startingWords });

  const names = Array.from(sprint.participants.values())
    .map((p) => p.username)
    .join(", ");

  if (sprint.announcementMessage) {
    const modeLabel = sprint.mode === "goal" && sprint.wordGoal ? ` · Goal: ${sprint.wordGoal} words` : sprint.mode !== "regular" ? ` · Mode: ${sprint.mode}` : "";
    const appBaseUrl = process.env.API_BASE_URL?.replace(/\/$/, "") ?? "";
    const joinLink = `${appBaseUrl}/room/${sprint.roomCode}`;
    const delayLabel = sprint.delayMinutes === 1 ? "1 minute" : `${sprint.delayMinutes} minutes`;

    await sprint.announcementMessage.edit(
      `📝 **A ${sprint.durationMinutes}-minute writing sprint is starting in ${delayLabel}!**${modeLabel}\n` +
      `Type \`/join\` to join. Room code: \`${sprint.roomCode}\`\n` +
      `Join on the website: ${joinLink}\n\n` +
      `✍️ Joined: ${names}`
    );
  }

  await interaction.reply({ content: `You've joined the sprint! Starting words: **${startingWords}**.`, ephemeral: true });
}
