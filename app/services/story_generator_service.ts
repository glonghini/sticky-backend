// app/services/StoryGeneratorService.ts

import env from '#start/env'
import { inject } from '@adonisjs/core'
import OpenAI from 'openai'


// Define a TypeScript interface for our story scenes for strong typing.
// This ensures data consistency throughout our app.
export interface StoryScene {
  id: number
  narrator: string
  character: string
  characterImagePrompt: string
  dialogue: string
  backgroundPrompt: string
}

@inject()
export default class StoryGeneratorService {
  // Use a private property to hold the OpenAI client instance
  private openai: OpenAI

  constructor() {
    // Initialize the OpenAI client in the constructor
    // It automatically reads the API key from process.env.OPENAI_API_KEY
    this.openai = new OpenAI({
      apiKey: env.get('OPENAI_API_KEY'),
    })
  }

  /**
   * Generates a linear story from a briefing using the OpenAI API.
   * @param briefing A short description of the story to generate.
   * @param sceneCount The exact number of scenes the story should have.
   * @returns A promise that resolves to an array of StoryScene objects.
   */
  async generateLinearStory(briefing: string, sceneCount: number): Promise<StoryScene[]> {
    const prompt = this.buildInitialPrompt(briefing, sceneCount)

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o', // Or 'gpt-3.5-turbo' for a faster, cheaper option
        messages: [
          {
            role: 'system',
            content: this.getSystemMessage(),
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        // This is CRUCIAL for reliable JSON output!
        response_format: { type: 'json_object' },
      })

      const content = completion.choices[0].message.content
      if (!content) {
        throw new Error('OpenAI returned an empty response.')
      }

      // Parse the JSON string into a JavaScript object
      const parsedResponse = JSON.parse(content)

      // We expect the story array to be under a "story" key, as requested in the prompt
      const storyArray = parsedResponse.story as StoryScene[]

      if (!Array.isArray(storyArray) || storyArray.length !== sceneCount) {
        throw new Error('AI did not return the expected story structure or scene count.')
      }

      return storyArray
    } catch (error) {
      console.error('Error calling OpenAI API:', error)
      // Re-throw the error to be handled by the controller
      throw new Error('Failed to generate story from AI service.')
    }
  }

  /**
   * Refines an EXISTING story based on user feedback.
   * @param existingStory The full array of the current story scenes.
   * @param refinementPrompt The user's instruction for what to change.
   * @returns A promise resolving to the NEW, updated array of StoryScene objects.
   */
  async refineStory(
    existingStory: StoryScene[],
    refinementPrompt: string
  ): Promise<StoryScene[]> {
    const prompt = this.buildRefinementPrompt(existingStory, refinementPrompt)
    const sceneCount = existingStory.length

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: this.getRefinementSystemMessage(), // A slightly different system message
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
      })

      const content = completion.choices[0].message.content
      if (!content) {
        throw new Error('OpenAI returned an empty response during refinement.')
      }

      const parsedResponse = JSON.parse(content)
      const storyArray = parsedResponse.story as StoryScene[]

      if (!Array.isArray(storyArray) || storyArray.length !== sceneCount) {
        console.warn('AI returned a story with a different number of scenes. This might be okay.', {
          expected: sceneCount,
          got: storyArray.length,
        })
        // For now, we'll accept it, but this is a point for potential stricter validation.
      }

      return storyArray
    } catch (error) {
      console.error('Error calling OpenAI API for refinement:', error)
      throw new Error('Failed to refine story from AI service.')
    }
  }


  /**
   * Defines the persona and strict rules for the AI.
   * This is separated for clarity and reusability.
   */
  private getSystemMessage(): string {
    return `You are an expert creative writer and a strict data architect for a web-based story game. Your task is to generate a linear story.

    RULES:
    1. Your ENTIRE response MUST be a single, valid JSON object.
    2. The JSON object must have a single root key named "story".
    3. The value of "story" must be a JSON array of scene objects.
    4. Do NOT include any text, explanations, or markdown before or after the JSON object.
    5. Each scene object in the array must contain these exact keys: "id", "narrator", "character", "characterImagePrompt", "dialogue", "backgroundPrompt".
    `
  }

  /**
   * Builds the user-facing prompt with the specific task.
   */
  private buildInitialPrompt(briefing: string, sceneCount: number): string {
    return `
    Generate a story based on the following details. The story array must contain exactly ${sceneCount} scenes.

    STORY BRIEFING: "${briefing}"
    `
  }

  private getRefinementSystemMessage(): string {
    return `You are a helpful story editor. Your task is to revise and rewrite a story based on user feedback.

    RULES:
    1. You will be given the [CURRENT_STORY] as a JSON array and a [REFINEMENT_PROMPT] with instructions.
    2. Your job is to rewrite the story according to the instructions.
    3. You MUST return the ENTIRE, new version of the story.
    4. Your response MUST be a single, valid JSON object with a single root key named "story".
    5. The value of "story" must be a JSON array of scene objects.
    6. Maintain the original number of scenes unless specifically asked to change it.
    7. Ensure every scene object in the new array has the correct keys: "id", "narrator", "character", "characterImagePrompt", "dialogue", "backgroundPrompt".
    `
  }

  private buildRefinementPrompt(existingStory: StoryScene[], refinementPrompt: string): string {
    const storyJsonString = JSON.stringify(existingStory, null, 2) // Pretty-print for the AI

    return `
    [CURRENT_STORY]:
    ${storyJsonString}

    [REFINEMENT_PROMPT]:
    "${refinementPrompt}"

    Please revise the story according to the refinement prompt and return the complete, updated story.
    `
  }
}