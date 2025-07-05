// app/controllers/story_finalization_controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import StorySession from '#models/story_session'
import vine from '@vinejs/vine'
import { FinalStoryService } from '#services/final_story_service'

@inject()
export default class FinalStoriesController {
  constructor(protected finalizationService: FinalStoryService) { }

  /**
   * Synchronously generates all images, updates the story, and returns the result.
   */
  async store({ request, response, params }: HttpContext) {
    const session = await StorySession.findByOrFail('uuid', params.sessionId)

    // The payload now expects the reference image URL
    const payload = await request.validateUsing(
      vine.compile(
        vine.object({
          referenceImageUrl: vine.string().url(),
        })
      )
    )

    // Call the service with the new parameter
    const finalizedStoryState = await this.finalizationService.generateFinalImages(
      session.currentStoryState,
      payload.referenceImageUrl
    )

    session.currentStoryState = finalizedStoryState
    await session.save()

    return response.ok(session)
  }
}
