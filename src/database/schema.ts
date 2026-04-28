import { relations } from 'drizzle-orm';
import { index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const usersTable = pgTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const roomsTable = pgTable('rooms', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  createdByUserId: text('created_by_user_id')
    .notNull()
    .references(() => usersTable.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const messagesTable = pgTable(
  'messages',
  {
    id: text('id').primaryKey(),
    roomId: text('room_id')
      .notNull()
      .references(() => roomsTable.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'restrict' }),
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    roomCreatedAtIdx: index('messages_room_created_at_idx').on(table.roomId, table.createdAt),
  }),
);

export const usersRelations = relations(usersTable, ({ many }) => ({
  rooms: many(roomsTable),
  messages: many(messagesTable),
}));

export const roomsRelations = relations(roomsTable, ({ one, many }) => ({
  creator: one(usersTable, {
    fields: [roomsTable.createdByUserId],
    references: [usersTable.id],
  }),
  messages: many(messagesTable),
}));

export const messagesRelations = relations(messagesTable, ({ one }) => ({
  room: one(roomsTable, {
    fields: [messagesTable.roomId],
    references: [roomsTable.id],
  }),
  author: one(usersTable, {
    fields: [messagesTable.userId],
    references: [usersTable.id],
  }),
}));
