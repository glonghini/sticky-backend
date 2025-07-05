import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

export default class RouteLoggerMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    /**
     * Middleware logic goes here (before the next call)
     */

    // Avoid logging static assets 
    if (!/^\/static/i.test(ctx.request.url())) {
      console.log(
        ctx.request.method(),
        ctx.request.url(),
        ctx.request.qs(),
      )
      if (ctx.request.hasBody()) console.log(ctx.request.body())
    }

    /**
     * Call next method in the pipeline and return its output
     */
    const output = await next()
    return output
  }
}