/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import ArtStylesController from '#controllers/art_styles_controller'
import FinalStoriesController from '#controllers/final_stories_controller'
import StoryGeneratorController from '#controllers/story_generator_controller'
import router from '@adonisjs/core/services/router'

router.get('/', async () => {
  return {
    hello: 'world',
  }
})

// Stories
router.resource('/stories', StoryGeneratorController).apiOnly()
// Art styles
router.resource('/art-styles', ArtStylesController).apiOnly()
// Final story
router.post('/final-story/:sessionId', [FinalStoriesController, 'store'])