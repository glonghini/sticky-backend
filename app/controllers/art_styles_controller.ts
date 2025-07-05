// app/controllers/art_styles_controller.ts

import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import StorySession from '#models/story_session'
import ArtStyleService from '#services/art_style_service'
import vine from '@vinejs/vine'

@inject()
export default class ArtStylesController {
  constructor(protected artStyleService: ArtStyleService) { }

  /**
   * Generates art style suggestions for a given story session.
   * Errors are handled by the global exception handler.
   */
  async show({ response, params }: HttpContext) {
    // 1. Find the story session by its UUID from the URL
    const session = await StorySession.findByOrFail('uuid', params.id)

    // 2. Check if the story has at least one scene
    if (!session.currentStoryState || session.currentStoryState.length === 0) {
      return response.badRequest({ message: 'Story has no scenes to analyze.' })
    }

    // 3. Get the first scene to use as context
    const firstScene = session.currentStoryState[0]

    // 4. Call our service to get the style suggestions with image URLs
    const suggestions = await this.artStyleService.suggestStyles(firstScene)

    // 5. Return the suggestions to the frontend
    return suggestions
  }

  async update({ request, response }: HttpContext) {
    // 1. Validate the incoming request body
    const payload = await request.validateUsing(
      vine.compile(
        vine.object({
          originalImageUrl: vine.string().url(),
          originalImagePrompt: vine.string().minLength(10),
          refinementPrompt: vine.string().minLength(5),
        })
      )
    )

    // 2. Call the service to get the new image URL
    const newImageUrl = await this.artStyleService.refineStyle(
      payload.originalImageUrl,
      payload.originalImagePrompt,
      payload.refinementPrompt
    )

    // 3. Return the new URL in the response
    return response.created({ newImageUrl })
  }
}