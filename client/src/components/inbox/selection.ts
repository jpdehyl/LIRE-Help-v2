import type { ConversationRow } from "./types";

export function resolveConversationSelection(
  conversations: Pick<ConversationRow, "id">[],
  selectedConversationId: string | null,
): string | null {
  if (selectedConversationId && conversations.some((conversation) => conversation.id === selectedConversationId)) {
    return selectedConversationId;
  }

  return conversations[0]?.id ?? null;
}
