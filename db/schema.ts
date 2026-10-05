import {sqliteTable,text,integer,primaryKey} from 'drizzle-orm/sqlite-core';
export const favorites=sqliteTable('favorites',{
  owner:text('owner').notNull(),id:text('id').notNull(),payload:text('payload').notNull(),createdAt:integer('created_at').notNull(),deleted:integer('deleted').notNull().default(0),
},t=>[primaryKey({columns:[t.owner,t.id]})]);
