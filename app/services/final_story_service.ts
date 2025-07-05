import { inject } from '@adonisjs/core'
import OpenAI from 'openai'
import env from '#start/env'
import { StoryScene } from './story_generator_service.js'

@inject()
export class FinalStoryService {
  private openai: OpenAI

  constructor() {
    this.openai = new OpenAI({ apiKey: env.get('OPENAI_API_KEY') })
  }

  /**
   * Main orchestration method. Creates a consistency prompt and then generates all images.
   * @param scenes The array of StoryScene objects to process.
   * @param referenceImageUrl The URL of the user's chosen style reference image.
   * @returns A promise that resolves to the new array of scenes with final image URLs.
   */
  async generateFinalImages(
    scenes: StoryScene[],
    referenceImageUrl: string
  ): Promise<StoryScene[]> {
    // === STEP 1: Generate the master consistency prompt from the reference image ===
    const consistencyPrompt = await this.createConsistencyPrompt(referenceImageUrl)
    console.log('Generated Master Consistency Prompt:', consistencyPrompt)

    // === STEP 2: Generate all scene images using the consistency prompt ===
    const imageGenerationPromises = scenes.map((scene) => {
      // Combine the master prompt with scene-specific details
      const finalPrompt = `${consistencyPrompt}. The scene is: "${scene.narrator}". The character is ${scene.character} and they are saying "${scene.dialogue}".`

      return this.openai.images.generate({
        model: 'dall-e-3',
        prompt: finalPrompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard',
      })
    })

    const imageResults = await Promise.all(imageGenerationPromises)

    const finalizedScenes = scenes.map((scene, index) => {
      const imageUrl = imageResults[index].data?.[0]?.url
      if (!imageUrl) {
        throw new Error(`DALL-E failed to generate image for scene ${scene.id}`)
      }

      return {
        ...scene,
        characterImagePrompt: imageUrl,
        backgroundPrompt: '',
      }
    })

    return finalizedScenes
  }

  /**
   * NEW METHOD: Uses GPT-4o's vision to create a detailed, reusable prompt.
   * This is the core of our consistency strategy.
   * @param imageUrl The URL of the reference image.
   * @returns A string containing the detailed "character sheet" prompt.
   */
  private async createConsistencyPrompt(imageUrl: string): Promise<string> {
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            "You are an expert character designer and DALL-E prompt engineer. Analyze the provided image and create a detailed, reusable prompt that describes the main character's specific physical appearance (hair style and color, eye color, facial structure, specific clothing, etc.) and the overall art style (e.g., 'digital painting', 'anime style', 'cyberpunk noir'). This description will be used to generate new images of the same character in different scenes. Output ONLY the descriptive prompt text.",
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Please generate the detailed character and style description for this image.',
            },
            {
              type: 'image_url',
              image_url: {
                url: imageUrl,
              },
            },
          ],
        },
      ],
      max_tokens: 400,
    })

    const newPrompt = completion.choices[0].message.content
    if (!newPrompt) {
      throw new Error('GPT-4o failed to generate a consistency prompt from the image.')
    }
    return newPrompt.trim()
  }
}