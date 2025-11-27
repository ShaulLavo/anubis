import { Elysia, t } from 'elysia'
import { cors } from '@elysiajs/cors'
import { env } from './env'

const app = new Elysia()
	.use(
		cors({
			origin: env.webOrigin
		})
	)
	.get('/', () => 'Hi Elysia')
	.get('/id/:id', ({ params: { id } }) => id)
	.post('/mirror', ({ body }) => body, {
		body: t.Object({
			id: t.Number(),
			name: t.String()
		})
	})
	.listen(env.serverPort)

console.log(
	`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
)

export type App = typeof app
