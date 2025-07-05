// app/services/ArtStyleService.ts

import env from '#start/env'
import { inject } from '@adonisjs/core'
import OpenAI from 'openai'
import { StoryScene } from './story_generator_service.js'

// Define the structure for a single art style suggestion
export interface ArtStyleSuggestion {
  name: string
  description: string
  imagePrompt: string // A master prompt for generating images in this style
  imageUrl: string
}

interface ArtStylePrompt {
  name: string
  description: string
  imagePrompt: string
}

@inject()
export default class ArtStyleService {
  private openai: OpenAI

  constructor() {
    this.openai = new OpenAI({
      apiKey: env.get('OPENAI_API_KEY'),
    })
  }

  /**
   * Generates three distinct art style suggestions, including preview images,
   * based on the first scene of a story.
   * @param firstScene The first StoryScene object from the finalized story.
   * @returns A promise that resolves to an array of three ArtStyleSuggestion objects.
   */
  async suggestStyles(firstScene: StoryScene): Promise<ArtStyleSuggestion[]> {
    // === STEP 1: Generate the style descriptions and prompts ===
    const stylePrompts = await this.generateStylePrompts(firstScene)

    // === STEP 2: Generate an image for each style suggestion in parallel ===
    const imageGenerationPromises = stylePrompts.map((style) => {
      // We combine the original scene's character prompt with the new style prompt
      // for a highly relevant and stylized image.
      const fullImagePrompt = `${firstScene.characterImagePrompt}, ${style.imagePrompt}`

      return this.openai.images.generate({
        model: 'dall-e-3',
        prompt: fullImagePrompt,
        n: 1, // We want one image per prompt
        size: '1024x1024', // Standard size for suggestions
        quality: 'standard', // 'standard' is faster and cheaper than 'hd'
      })
    })

    // Wait for all image generation requests to complete
    const imageResults = await Promise.all(imageGenerationPromises)

    // === STEP 3: Combine the style info with the new image URLs ===
    const finalSuggestions = stylePrompts.map((style, index) => {
      const imageUrl = imageResults[index].data?.[0]?.url
      if (!imageUrl) {
        throw new Error(`DALL-E did not return an image URL for style: ${style.name}`)
      }

      return {
        ...style,
        imageUrl, // Add the generated URL
      }
    })

    return finalSuggestions
  }

  /**
   * Private helper to perform the first step: getting text-based style suggestions.
   */
  private async generateStylePrompts(firstScene: StoryScene): Promise<ArtStylePrompt[]> {
    const prompt = this.buildPrompt(firstScene)

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: this.getSystemMessage() },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
    })

    const content = completion.choices[0].message.content
    if (!content) {
      throw new Error('OpenAI returned an empty response for art styles.')
    }

    const parsedResponse = JSON.parse(content)
    const styles = parsedResponse.artStyles as ArtStylePrompt[]

    if (!Array.isArray(styles) || styles.length !== 3) {
      throw new Error('AI did not return exactly three art style suggestions.')
    }
    return styles
  }

  /**
   * The persona and rules for our "AI Art Director".
   */
  private getSystemMessage(): string {
    return `You are a professional Art Director for a video game studio, specializing in visual storytelling. Your task is to propose three distinct and compelling art styles for a new story.

    RULES:
    1.  You will be given a description of the first scene.
    2.  Your response MUST be a single, valid JSON object.
    3.  The JSON object must have a single root key named "artStyles".
    4.  The value of "artStyles" must be a JSON array containing EXACTLY THREE style suggestion objects.
    5.  Each style suggestion object must have these keys: "name" (a catchy name for the style), "description" (a brief explanation of the style's look and feel), and "imagePrompt" (a detailed, reusable prompt suffix for an AI image generator that encapsulates the style).
    `
  }

  /**
   * Builds the prompt using the first scene's data.
   */
  private buildPrompt(firstScene: StoryScene): string {
    // We combine the narrator text, character description, and background description
    // to give the AI a rich context for the scene's mood and content.
    const sceneContext = `
    - Setting: ${firstScene.narrator}
    - Character in Scene: ${firstScene.character}
    - Character Details: ${firstScene.characterImagePrompt}
    - Background Details: ${firstScene.backgroundPrompt}
    `

    return `
    Based on the following scene context, please generate three distinct art style proposals.

    [SCENE CONTEXT]:
    ${sceneContext}
    `
  }

  /**
   * Refines a single art style image using a user's text prompt.
   * Uses GPT-4o's vision to understand the original image and the user's request.
   * @param originalImageUrl The URL of the image to be changed.
   * @param originalImagePrompt The DALL-E prompt that created the original image.
   * @param refinementPrompt The user's instruction for what to change.
   * @returns A promise that resolves to the URL of the new, refined image.
   */
  async refineStyle(
    originalImageUrl: string,
    originalImagePrompt: string,
    refinementPrompt: string
  ): Promise<string> {
    // === STEP 1: Use GPT-4o to create a new, improved DALL-E prompt ===
    const newPrompt = await this.getRefinedImagePrompt(
      originalImageUrl,
      originalImagePrompt,
      refinementPrompt
    )

    // console.log(`Original Prompt: ${originalImagePrompt}`)
    // console.log(`Refined Prompt: ${newPrompt}`)

    // === STEP 2: Use the new prompt to generate a new image with DALL-E 3 ===
    const imageResponse = await this.openai.images.generate({
      model: 'dall-e-3',
      prompt: newPrompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
    })

    const newImageUrl = imageResponse.data?.[0]?.url
    if (!newImageUrl) {
      throw new Error('DALL-E failed to generate the refined image.')
    }

    return newImageUrl
  }

  /**
   * Private helper that uses GPT-4o's multimodal capabilities to rewrite a prompt.
   */
  private async getRefinedImagePrompt(
    imageUrl: string,
    originalPrompt: string,
    refinementRequest: string
  ): Promise<string> {
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: "You are an expert DALL-E prompt engineer. You will be shown an image, the prompt that created it, and a user's request for a change. Your job is to create a new, single, cohesive DALL-E prompt that keeps the original image's style and composition, but incorporates the user's change. Output ONLY the new prompt text, nothing else.",
        },
        {
          role: 'user',
          content: [
            // This is the multimodal part: we send text and an image in one message
            {
              type: 'text',
              text: `This is the original prompt: "${originalPrompt}". This is my change request: "${refinementRequest}". Please give me the new, complete DALL-E prompt.`,
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
      max_tokens: 500, // A reasonable limit for a prompt
    })

    const newPrompt = completion.choices[0].message.content
    if (!newPrompt) {
      throw new Error('GPT-4o failed to generate a refined prompt.')
    }

    return newPrompt.trim()
  }
}