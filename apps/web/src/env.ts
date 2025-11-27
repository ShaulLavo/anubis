import { z } from 'zod'

const envSchema = z.object({
	VITE_API_ORIGIN: z.url().optional(),
	VITE_SERVER_PORT: z.coerce.number().int().positive()
})

const envData = envSchema.parse(import.meta.env)

export const env = {
	apiOrigin:
		envData.VITE_API_ORIGIN ?? `http://localhost:${envData.VITE_SERVER_PORT}`
}
