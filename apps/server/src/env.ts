import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
	VITE_SERVER_PORT: z.coerce.number().int().positive(),
	VITE_WEB_PORT: z.coerce.number().int().positive(),
	VITE_WEB_ORIGIN: z.url().optional(),
	WEB_ORIGIN: z.url().optional()
})

const envData = envSchema.parse(process.env)

const serverPort = envData.VITE_SERVER_PORT
const webPort = envData.VITE_WEB_PORT
const webOrigin = envData.VITE_WEB_ORIGIN ?? envData.WEB_ORIGIN

export const env = {
	serverPort,
	webPort,
	webOrigin: webOrigin ?? `http://localhost:${webPort}`
}
