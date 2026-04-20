# Lire Help v2 Inbox Actions Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to execute this task-by-task.

**Goal:** Add the missing operational inbox actions that make the Intercom-style inbox actually usable: reply, archive/unarchive, tag add/remove, snooze/unsnooze, spam/unspam, and admin-only soft delete/restore.

**Architecture:** Keep workflow state (`status`) separate from mailbox visibility (`archive`, `spam`, `delete`, `snooze`). Extend the existing per-action endpoint pattern already used by assignee/status/priority/note mutations. Return full `ConversationDetail` from every mutation.

**Tech Stack:** React + TanStack Query + Express + Drizzle + Postgres

---

## What exists already

Implemented end-to-end now:
- assign / unassign
- change status
- change priority
- add internal note
- AI draft generation

Scaffolded but intentionally blocked:
- reply composer UI exists, but outbound reply send is not implemented

Missing:
- reply
- archive / unarchive
- tag add / remove
- snooze / unsnooze
- spam / unspam
- admin-only soft delete / restore

---

## Non-negotiable product rules

1. **Archive is not resolved.**
   - `resolved` = the work is done.
   - `archived` = hide it from normal inbox views.

2. **Spam is not status.**
   - spam is mailbox classification, not workflow state.

3. **Delete is soft delete only.**
   - recoverable
   - audit-friendly
   - admin-only

4. **Snooze is temporary hiding only.**
   - do not mutate workflow status just because it was snoozed.

5. **Do not invent a generic action bus.**
   - this repo already uses one endpoint per action.
   - keep that pattern.

---

## Exact files to touch

### Required
- `shared/schema.ts`
- `shared/helpdesk.ts`
- `server/helpdesk-routes.ts`
- `server/storage.ts`
- `client/src/lib/helpdesk.ts`
- `client/src/components/inbox/conversation-detail.tsx`

### Likely also needed
- `client/src/components/inbox/inbox-shell.tsx`
- `client/src/components/inbox/conversation-list.tsx`
- `tests/helpdesk-role-gating.test.ts`

---

## Data model changes

### Task 1: Add mailbox visibility fields to `help_conversations`

**Objective:** Create first-class mailbox state without polluting workflow status.

**Files:**
- Modify: `shared/schema.ts`

**Add these fields to `helpConversations`:**

```ts
visibilityStatus: text("visibility_status").notNull().default("active"),
previousVisibilityStatus: text("previous_visibility_status"),
visibilityChangedAt: timestamp("visibility_changed_at"),
visibilityChangedByStaffId: varchar("visibility_changed_by_staff_id").references(() => staffUsers.id),
snoozedByStaffId: varchar("snoozed_by_staff_id").references(() => staffUsers.id),
deletedAt: timestamp("deleted_at"),
deletedByStaffId: varchar("deleted_by_staff_id").references(() => staffUsers.id),
deleteReason: text("delete_reason"),
```

**Use these semantics:**
- `visibilityStatus = "active" | "archived" | "spam" | "deleted"`
- `previousVisibilityStatus` is used for restore after soft delete
- existing `snoozedUntil` stays in use

**Do not use `status` for any of this.**

---

### Task 2: Add tag uniqueness guards

**Objective:** Prevent duplicate tag attachment and duplicate tag definitions.

**Files:**
- Modify: `shared/schema.ts`

**Add indexes:**

```ts
// on helpConversationTags
uniqueIndex("help_conversation_tags_conversation_tag_uq").on(table.conversationId, table.tagId)

// strongly recommended on helpTags
uniqueIndex("help_tags_tenant_property_slug_uq").on(table.tenantId, table.propertyId, table.slug)
```

---

## Shared type changes

### Task 3: Extend inbox views and mailbox state types

**Objective:** Teach the app about archived/spam/snoozed/trash views and mailbox metadata.

**Files:**
- Modify: `shared/helpdesk.ts`

**Add:**

```ts
export type ConversationVisibilityStatus = "active" | "archived" | "spam" | "deleted";
```

Extend `inboxViewKeys` with:

```ts
"snoozed",
"archived",
"spam",
"trash",
```

Keep them in `saved_views` for now. No new sidebar section needed.

---

### Task 4: Extend `ConversationRow` and `ConversationDetail`

**Objective:** Expose mailbox state and tag options to the UI.

**Files:**
- Modify: `shared/helpdesk.ts`

**Add:**

```ts
export interface HelpdeskTagOption {
  id: string;
  name: string;
  slug: string;
  color: string | null;
}
```

Add to `ConversationRow`:

```ts
visibilityStatus: ConversationVisibilityStatus;
snoozedUntil: string | null;
snoozedUntilLabel: string | null;
```

Add to `ConversationDetail`:

```ts
mailbox: {
  visibilityStatus: ConversationVisibilityStatus;
  snoozedUntil: string | null;
  snoozedUntilLabel: string | null;
  deletedAtLabel: string | null;
  deleteReason: string | null;
  canReply: boolean;
  canArchive: boolean;
  canSpam: boolean;
  canSoftDelete: boolean;
};
availableTags?: HelpdeskTagOption[];
```

---

## Backend route plan

### Task 5: Add the missing action routes

**Objective:** Extend the current route pattern without changing the architecture.

**Files:**
- Modify: `server/helpdesk-routes.ts`

**Add these endpoints:**

```ts
POST   /api/helpdesk/inbox/conversations/:conversationId/replies
PATCH  /api/helpdesk/inbox/conversations/:conversationId/archive
POST   /api/helpdesk/inbox/conversations/:conversationId/tags
DELETE /api/helpdesk/inbox/conversations/:conversationId/tags/:tagId
PATCH  /api/helpdesk/inbox/conversations/:conversationId/snooze
PATCH  /api/helpdesk/inbox/conversations/:conversationId/spam
PATCH  /api/helpdesk/inbox/conversations/:conversationId/soft-delete
```

**Auth rules:**
- reply/archive/tags/snooze/spam → `requireStaffRole(...HELPDESK_AGENT_ROLES)`
- soft delete → admin-only (`requireAdmin` or equivalent privileged role gate)

**Validation rules:**
- reply body required
- reply optional status must match valid workflow statuses
- snooze must be future ISO timestamp or `null`
- soft delete reason optional
- archive/spam payloads are booleans

---

## Storage layer plan

### Task 6: Add reply mutation

**Objective:** Ship real reply behavior using current `help_messages`.

**Files:**
- Modify: `server/storage.ts`

**Create:**
```ts
replyToHelpConversation(...)
```

**Behavior:**
- insert `help_messages` row with:
  - `messageType: "teammate"`
  - `authorStaffId`
  - `authorLabel`
  - `body`
  - `metadataJson.delivery`
- update `help_conversations`:
  - `preview`
  - `lastMessageAt`
  - `messageCount += 1`
  - `unreadCount = 0`
  - default status to `waiting_on_customer` unless explicit valid status provided
- update `help_tickets`:
  - matching status
  - set `firstResponseAt` if null
  - `updatedAt = now`
- return `getHelpConversationDetail(...)`

**Important:**
There is no outbound transport layer yet. Phase 1 reply should be “recorded teammate reply in system state.” Real email delivery can come later.

---

### Task 7: Add archive / unarchive mutation

**Objective:** Hide conversations from normal active views without touching workflow status.

**Files:**
- Modify: `server/storage.ts`

**Create:**
```ts
updateHelpConversationArchiveState(...)
```

**Behavior:**
- `archived: true` → `visibilityStatus = "archived"`
- `archived: false` → `visibilityStatus = "active"`
- clear `snoozedUntil` when archiving
- set visibility audit fields
- insert `system` timeline message
- return updated detail

**Do not touch:**
- `status`
- `resolvedAt`
- `closedAt`

---

### Task 8: Add tag add/remove mutations

**Objective:** Make the existing tag card useful.

**Files:**
- Modify: `server/storage.ts`

**Create:**
```ts
addHelpConversationTag(...)
removeHelpConversationTag(...)
```

**Behavior:**
- validate tenant/property scope
- add/remove `help_conversation_tags`
- no-op if already present on add
- optionally log `system` message
- return updated detail

---

### Task 9: Add snooze / unsnooze mutation

**Objective:** Support temporary hide-until workflows.

**Files:**
- Modify: `server/storage.ts`

**Create:**
```ts
updateHelpConversationSnooze(...)
```

**Behavior:**
- future ISO date → set `snoozedUntil`, `snoozedByStaffId`
- `null` → clear both
- insert `system` timeline message
- return updated detail

**Do not change workflow status.**

---

### Task 10: Add spam / unspam mutation

**Objective:** Classify junk without abusing status or tags.

**Files:**
- Modify: `server/storage.ts`

**Create:**
```ts
updateHelpConversationSpamState(...)
```

**Behavior:**
- `spam: true` → `visibilityStatus = "spam"`
- `spam: false` → `visibilityStatus = "active"`
- clear `snoozedUntil` when marking spam
- set visibility audit fields
- log a `system` timeline message
- return updated detail

---

### Task 11: Add admin-only soft delete / restore mutation

**Objective:** Add recoverable admin cleanup without destroying records.

**Files:**
- Modify: `server/storage.ts`

**Create:**
```ts
updateHelpConversationSoftDeleteState(...)
```

**Behavior:**
- when deleting:
  - store `previousVisibilityStatus`
  - set `visibilityStatus = "deleted"`
  - set `deletedAt`, `deletedByStaffId`, `deleteReason`
  - clear `snoozedUntil`
  - set visibility audit fields
- when restoring:
  - set `visibilityStatus = previousVisibilityStatus ?? "active"`
  - keep delete audit history unless there is a strong reason to clear it
- log `system` timeline message
- return updated detail

**No hard deletes. Period.**

---

## Conversation list and detail shaping

### Task 12: Update list filtering and view matching

**Objective:** Keep active queues clean while still exposing recovery views.

**Files:**
- Modify: `server/storage.ts`

**Change:**
- `buildConversationRows(...)`
- `matchesInboxView(...)`
- any helper used by inbox navigation counts

**Rules:**

For standard operational views:
- include only `visibilityStatus === "active"`
- exclude rows where `snoozedUntil > now`

Dedicated views:
- `snoozed` → active + snoozed in future
- `archived` → archived
- `spam` → spam
- `trash` → deleted

**This is where the inbox starts acting like a real inbox instead of a demo.**

---

### Task 13: Extend detail payload assembly

**Objective:** Feed the UI everything it needs in one response.

**Files:**
- Modify: `server/storage.ts`

**Change `getHelpConversationDetail(...)` to include:**
- `mailbox`
- `availableTags`
- any human-friendly labels for snooze/delete state

Use `context.tags` the same way the current code uses `context.staff` for assignees.

---

## Client API plan

### Task 14: Add client methods for every new action

**Objective:** Keep the client API layer symmetric with the server routes.

**Files:**
- Modify: `client/src/lib/helpdesk.ts`

**Add:**

```ts
replyToConversation(conversationId, body, status?)
updateArchiveState(conversationId, archived)
addTag(conversationId, tagId)
removeTag(conversationId, tagId)
updateSnooze(conversationId, snoozedUntil)
updateSpamState(conversationId, spam)
updateSoftDeleteState(conversationId, deleted, reason?)
```

Every mutation should return `ConversationDetail`.

---

## UI plan

### Task 15: Replace the fake reply composer with a real one

**Objective:** Make the existing Reply tab actually work.

**Files:**
- Modify: `client/src/components/inbox/conversation-detail.tsx`

**Change:**
Replace the current placeholder under `composerMode === "reply"` with:
- textarea
- optional status select defaulting to `waiting_on_customer`
- primary button `Send reply`
- mutation state + error handling

**Do not dump reply text into internal notes.** That would be clown behavior.

---

### Task 16: Add mailbox action controls to the detail header

**Objective:** Put the high-value actions where operators can hit them fast.

**Files:**
- Modify: `client/src/components/inbox/conversation-detail.tsx`

**Add to header action cluster:**
- `Archive` / `Unarchive`
- `Snooze`
- `More` menu:
  - `Mark as spam` / `Remove from spam`
  - `Soft delete` / `Restore` (admin only)

**Why header:**
These are conversation-level controls, not just metadata edits.

---

### Task 17: Make the tags card interactive

**Objective:** Upgrade the current passive tags display into a real editing surface.

**Files:**
- Modify: `client/src/components/inbox/conversation-detail.tsx`

**Change tags UI to:**
- removable tag chips
- select/dropdown for available tags
- `Add tag` button

Keep it in the right rail.

---

### Task 18: Add visible snooze state and recovery actions

**Objective:** Prevent snooze from becoming invisible state rot.

**Files:**
- Modify: `client/src/components/inbox/conversation-detail.tsx`

**Show:**
- `Snoozed until ...` label when active
- `Remove snooze` action
- simple preset or datetime picker for snooze time

---

### Task 19: Ensure archive/spam/delete actions reselect or clear current conversation cleanly

**Objective:** Avoid broken selection state when the current row disappears from the active view.

**Files:**
- Modify: `client/src/components/inbox/inbox-shell.tsx`
- Possibly modify: `client/src/components/inbox/conversation-list.tsx`

**Behavior:**
After archive/spam/delete/snooze moves a conversation out of the current active view:
- refetch list
- if current conversation no longer exists in the active dataset, select the next row or clear selection cleanly

---

### Task 20: Add recovery views to the sidebar

**Objective:** Make unarchive/unspam/restore actually discoverable.

**Files:**
- Modify: `shared/helpdesk.ts`
- Modify: `server/storage.ts`
- Possibly modify: inbox nav UI components if labels/order need tweaks

**Add sidebar views:**
- Snoozed
- Archived
- Spam
- Trash

---

## Testing plan

### Task 21: Extend role gating coverage

**Objective:** Make sure readonly users cannot mutate anything they shouldn’t.

**Files:**
- Modify: `tests/helpdesk-role-gating.test.ts`

**Add tests for:**
- reply
- archive
- add tag
- remove tag
- snooze
- spam
- soft delete

Include privileged-role checks for soft delete.

---

### Task 22: Add storage / behavior regression tests

**Objective:** Lock the action model down before it drifts.

**Files:**
- Create or modify relevant helpdesk tests in the repo’s existing test layout

**Must cover:**
- archive does not change status
- snoozed rows disappear from active views and appear in snoozed view
- spam rows disappear from active views and appear in spam view
- soft-deleted rows move to trash and restore correctly
- tag add/remove is idempotent enough
- reply creates teammate timeline item and sets status correctly

---

## Recommended implementation order

### Phase 1 — mailbox-state foundation
1. data model fields
2. shared types
3. archive / spam / soft delete
4. list filtering + recovery views

### Phase 2 — tags
5. add/remove tags
6. interactive tag UI

### Phase 3 — snooze
7. snooze mutation
8. snooze UI + list behavior

### Phase 4 — reply
9. reply mutation
10. real reply composer UI

**Reason:**
- archive/spam/delete/tags/snooze all fit the current architecture cleanly
- reply is the only action with transport expectations, so it comes last unless you explicitly want “recorded in-app reply only” first

---

## Exact recommendation for now

Build this sequence:
1. archive / unarchive
2. spam / unspam
3. soft delete / restore
4. tags add / remove
5. snooze / unsnooze
6. reply

That’s the right order. Not because it’s cute. Because it matches the current repo and won’t paint you into a stupid corner.
