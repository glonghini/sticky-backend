// app/controllers/stories_controller.ts

import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import StoryGeneratorService from '#services/story_generator_service'
import vine from '@vinejs/vine'
import StorySession from '#models/story_session'

@inject()
export default class StoryGeneratorController {
  // AdonisJS will automatically inject an instance of the service for us!
  constructor(protected storyService: StoryGeneratorService) { }

  async store({ request, response }: HttpContext) {
    // 1. Validate the incoming request body
    const payload = await request.validateUsing(
      vine.compile(
        vine.object({
          briefing: vine.string().minLength(10),
          sceneCount: vine.number().min(2).max(10), // Set reasonable limits
        })
      )
    )

    // 2. Generate the initial story
    const initialStory = await this.storyService.generateLinearStory(
      payload.briefing,
      payload.sceneCount
    )

    // 3. Create and save the session to the database
    const session = await StorySession.create({
      initialBriefing: payload.briefing,
      sceneCount: payload.sceneCount,
      currentStoryState: initialStory,
    })

    // 4. Return the session ID and the story
    return response.created({
      sessionId: session.uuid,
      story: session.currentStoryState,
    })
  }

  async update({ request, response, params }: HttpContext) {
    // 1. Find the existing session by its UUID
    const session = await StorySession.findByOrFail('uuid', params.id)

    // 2. Validate the refinement prompt
    const payload = await request.validateUsing(
      vine.compile(
        vine.object({
          prompt: vine.string().minLength(5),
        })
      )
    )

    // 3. Call the service with the current story and the new prompt
    const refinedStory = await this.storyService.refineStory(
      session.currentStoryState,
      payload.prompt
    )

    // 4. Update the session in the database with the new story state
    session.currentStoryState = refinedStory
    await session.save()

    // 5. Return the updated story
    return response.ok({
      sessionId: session.uuid,
      story: session.currentStoryState,
    })
  }
}