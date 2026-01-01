import { Bash, defineCommand } from 'just-bash'
import type { FsContext, FsDirTreeNode } from '@repo/fs'
import { VfsBashAdapter } from './VfsBashAdapter'
import type { ShellContext } from './commands'

export type JustBashAdapter = {
	exec: (
		command: string
	) => Promise<{ stdout: string; stderr: string; exitCode: number }>
	dispose: () => void
	/** Get the VFS adapter if using real filesystem */
	getVfsAdapter: () => VfsBashAdapter | undefined
	getPrompt: () => string
}

export function createJustBashAdapter(
	fsContext?: FsContext,
	tree?: FsDirTreeNode,
	shellContext?: ShellContext
): JustBashAdapter {
	const vfsAdapter = fsContext ? new VfsBashAdapter(fsContext, tree) : undefined

	// Define custom commands
	const customCommands = [
		defineCommand('open', async (args, ctx) => {
			if (!shellContext) {
				return {
					stdout: '',
					stderr: 'open: shell not available\n',
					exitCode: 1,
				}
			}
			const path = args[0]
			if (!path) {
				return { stdout: '', stderr: 'usage: open <file>\n', exitCode: 1 }
			}

			// Resolve absolute path in VFS
			// Note: ctx.fs is our VfsBashAdapter which implements resolvePath
			const resolved = ctx.fs.resolvePath(ctx.cwd, path)

			// Check if file exists
			try {
				await ctx.fs.stat(resolved)
			} catch {
				return {
					stdout: '',
					stderr: `open: ${path}: No such file or directory\n`,
					exitCode: 1,
				}
			}

			// Strip leading slash for VFS action
			// just-bash uses absolute paths (/file), but app expects relative (file)
			const target = resolved.startsWith('/') ? resolved.slice(1) : resolved

			try {
				await shellContext.actions.selectPath(target, { forceReload: true })
				return { stdout: `Opened ${target}\n`, stderr: '', exitCode: 0 }
			} catch (err: any) {
				return { stdout: '', stderr: `open: ${err.message}\n`, exitCode: 1 }
			}
		}),
	]
	// Alias code to open
	customCommands.push({
		...customCommands[0]!,
		name: 'code',
	})

	const bash = new Bash({
		fs: vfsAdapter,
		cwd: '/',
		customCommands,
	})

	// Maintain persistent state since Bash class is stateless
	let currentCwd = '/'
	let currentEnv: Record<string, string> = {
		PS1: '\\w $ ',
	}

	return {
		exec: async (cmd: string) => {
			const result = await bash.exec(cmd, {
				cwd: currentCwd,
				env: currentEnv,
			})

			if (result.env) {
				currentEnv = result.env
				if (result.env.PWD) {
					currentCwd = result.env.PWD
				}
			} else {
				//  cd might fail to update if we don't get the env back.
			}

			return result
		},
		dispose: () => {},
		getVfsAdapter: () => vfsAdapter,
		getPrompt: () => {
			const ps1 = currentEnv['PS1'] || '$ '
			const cwd =
				currentCwd === '/'
					? '/'
					: currentCwd.replace(/^\/home\/user/, '') || '/'
			return ps1.replace('\\w', cwd)
		},
	}
}
