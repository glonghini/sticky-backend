// database/migrations/..._create_story_sessions_table.ts
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'story_sessions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id') // The unique ID for the session
      table.uuid('uuid').unique().notNullable() // A public-facing unique ID (safer than exposing auto-incrementing IDs)

      // Store the original user request
      table.text('initial_briefing').notNullable()
      table.integer('scene_count').notNullable()

      // The most important column: the current state of the story
      // Storing this as JSON is perfect for our use case.
      table.json('current_story_state').notNullable()

      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}