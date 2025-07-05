// app/models/story_session.ts
import { DateTime } from 'luxon'
import { BaseModel, beforeCreate, column } from '@adonisjs/lucid/orm'
import { randomUUID } from 'node:crypto'
import { StoryScene } from '#services/story_generator_service'

export default class StorySession extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare uuid: string

  @column()
  declare initialBriefing: string

  @column()
  declare sceneCount: number

  // Tell Lucid to automatically stringify/parse this column from/to JSON
  @column({
    serialize: (value) => (value ? JSON.stringify(value) : null),
    prepare: (value) => (value ? JSON.stringify(value) : null),
    consume: (value) => (value ? JSON.parse(value) : null),
  })
  declare currentStoryState: StoryScene[]

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Automatically generate a UUID before creating a new record
  @beforeCreate()
  public static async generateUuid(session: StorySession) {
    if (!session.uuid) {
      session.uuid = randomUUID()
    }
  }
}