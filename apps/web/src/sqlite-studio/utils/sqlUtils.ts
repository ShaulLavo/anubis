export const splitStatements = (sql: string): string[] => {
	const statements: string[] = []
	let buffer = ''
	let state: 'NORMAL' | 'SINGLE' | 'DOUBLE' | 'BLOCK' | 'LINE' = 'NORMAL'

	for (let i = 0; i < sql.length; i++) {
		const char = sql[i]
		const nextChar = sql[i + 1]

		buffer += char

		if (state === 'LINE') {
			if (char === '\n') {
				state = 'NORMAL'
			}
			continue
		}

		if (state === 'BLOCK') {
			if (char === '*' && nextChar === '/') {
				state = 'NORMAL'
				buffer += '/'
				i++
			}
			continue
		}

		if (state === 'SINGLE') {
			if (char === "'") {
				if (nextChar === "'") {
					buffer += "'"
					i++
				} else {
					state = 'NORMAL'
				}
			}
			continue
		}

		if (state === 'DOUBLE') {
			if (char === '"') {
				if (nextChar === '"') {
					buffer += '"'
					i++
				} else {
					state = 'NORMAL'
				}
			}
			continue
		}

		// NORMAL state
		if (char === '-' && nextChar === '-') {
			state = 'LINE'
			buffer += '-' // consume next dash
			i++
			continue
		}

		if (char === '/' && nextChar === '*') {
			state = 'BLOCK'
			buffer += '*'
			i++
			continue
		}

		if (char === "'") {
			state = 'SINGLE'
			continue
		}

		if (char === '"') {
			state = 'DOUBLE'
			continue
		}

		if (char === ';') {
			const trimmed = buffer.trim()
			if (trimmed) {
				statements.push(trimmed)
			}
			buffer = ''
		}
	}

	const trimmed = buffer.trim()
	if (trimmed) {
		statements.push(trimmed)
	}

	return statements
}

export const quoteIdentifier = (id: string) => {
	return `"${id.replace(/"/g, '""')}"`
}
