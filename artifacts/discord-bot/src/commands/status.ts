import { SlashCommandBuilder, ChatInputCommandInteraction, TextChannel } from "discord.js";
import { getSprint, hasSprint } from "../sprintManager.js";

export const data = new SlashCommandBuilder()
  .setName("status")
  .setDescription("Show current sprint status and participants");

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

  const statusLabels: Record<string, string> = {
    joining: `⏳ Waiting to start (${sprint.delayMinutes} min delay)`,
    running: "🖊️ Running",
    collecting: "⏱️ Collecting word counts",
    done: "✅ Finished",
  };

  const modeLabel = sprint.mode === "goal" && sprint.wordGoal
    ? `goal (${sprint.wordGoal} words)`
    : sprint.mode;

  const names = sprint.participants.size > 0
    ? Array.from(sprint.participants.values()).map((p) => p.username).join(", ")
    : "No one yet — type `/join` to join!";

  let timeInfo = "";
  if (sprint.status === "running" && sprint.sprintStartedAt) {
    const elapsed = Date.now() - sprint.sprintStartedAt;
    const remaining = Math.max(0, sprint.durationMinutes * 60 * 1000 - elapsed);
    const m = Math.floor(remaining / 60000);
    const s = Math.floor((remaining % 60000) / 1000);
    timeInfo = `\n⏰ **Time remaining:** ${m}m ${s}s`;
  }

  await interaction.reply({
    content:
      `📋 **Sprint Status**\n` +
      `**Status:** ${statusLabels[sprint.status] ?? sprint.status}\n` +
      `**Duration:** ${sprint.durationMinutes} minutes\n` +
      `**Mode:** ${modeLabel}\n` +
      `**Room code:** \`${sprint.roomCode}\`${timeInfo}\n\n` +
      `**Participants (${sprint.participants.size}):** ${names}`,
    ephemeral: true,
  });
}
