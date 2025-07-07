# AI Story Studio - Backend

This is the AdonisJS backend for the AI Story Studio application. It leverages OpenAI's GPT and DALL-E models to collaboratively generate, refine, and visualize narrative stories via a RESTful API.

## Database: sqlite3

The application uses sqlite3 to store different user sessions. They are stored in a single table "story_session". Each row contains the uuid of each story, the initial description, number of scenes and the current story state (as JSON).

## Core Logic: Services

Services contain all interactions with the OpenAI API and for processing the data.

### `app/services/story_generator_service.ts`

Handles the creation and textual refinement of the story.

*   **`generateLinearStory`**: Generates the initial draft of a story from a user's briefing and a specified scene count.
*   **`refineStory`**: Takes the entire current story state and a user's refinement prompt to generate a new, updated version of the story, ensuring contextual consistency.
*   **`buildInitialPrompt`, `getRefinementSystemMessage` and `buildRefinementPrompt`**: These methods are meant to build the prompt to be sent to the API.

### `app/services/art_style_service.ts`

Manages the visual direction of the story, suggesting styles and refining them.

*   **`suggestStyles`**: Analyzes the first scene of the story to generate three distinct art style suggestions. This is an orchestrated process that first generates text prompts for styles with GPT-4o, then uses those prompts to create preview images with DALL-E.
*   **`refineStyle`**: A multimodal method that takes a reference image URL, its original prompt, and a user's text request. It uses GPT-4o's vision capabilities to analyze the image and create a *new*, improved DALL-E prompt that incorporates the requested changes, then generates a new image.
*   **`generateStylePrompts`, `getSystemMessage`, `buildPrompt` and `getRefinedImagePrompt`**: These methods are meant to build the prompt to be sent to the API.

### `app/services/final_story_service.ts`

Performs the final production step, generating all scene images with a consistent style.

*   **`generateFinalImages`**: This is the core method for achieving visual consistency.
    *   It first calls a helper method that uses GPT-4o vision to analyze the user's chosen reference image. It creates a highly detailed "character sheet" prompt describing the character's key features and the overall art style.
    *   It then iterates through all scenes in the story. For each scene, it combines the master "character sheet" prompt with the scene's specific details (narrator, dialogue) to create a unique yet consistent final prompt for DALL-E.
    *   It returns the complete story array with all image prompts replaced by the final, generated image URLs.

---

## API Layer: Controllers

Controllers are the entry point for API requests. They are responsible for validating input, calling the appropriate services, and formatting the HTTP response.

### `app/controllers/StoryGeneratorController.ts`

Manages the lifecycle of a `StorySession` resource, which represents a single user-created story.

*   **`store`** (Handles `POST /stories`):
    *   Receives a story briefing and scene count.
    *   Calls `StoryGeneratorService` to create the initial story draft.
    *   Creates a new `StorySession` record in the database.
*   **`update`** (Handles `PATCH /stories/:id`):
    *   Receives a refinement prompt for an existing story.
    *   Calls `StoryGeneratorService` to get the updated story text.
    *   Saves the new state to the corresponding `StorySession` in the database.

### `app/controllers/ArtStylesController.ts`

Handles requests related to generating and refining the visual art style for a story.

*   **`show`** (Handles `GET /art-styles/:id`):
    *   Fetches a `StorySession` using the `sessionId` from the URL.
    *   Calls `ArtStyleService` to generate three visual style suggestions, complete with preview images.
*   **`update`** (Handles `PATCH /art-styles/:id`):
    *   This action handles the refinement of a *single* art style image.
    *   It receives the image URL, original prompt, and the user's new refinement text.
    *   Calls the `refineStyle` method in `ArtStyleService` and returns the URL of the newly generated image.

### `app/controllers/FinalStoriesController.ts`

Handles the final, synchronous story production request.

*   **`store`** (Handles `POST /stories/:sessionId/final-story`):
    *   This is the final step in the user's journey.
    *   It receives the URL of the single reference image the user has chosen.
    *   Calls the `StoryFinalizationService` to generate all scene images with a consistent style based on the reference image.
    *   This is a long-running request; it waits for all images to be generated.
    *   Saves the final story state (with all new image URLs) to the database and returns the completed `StorySession` object.
