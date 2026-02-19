import type { PrFileDiff } from './types'

/**
 * Data format expected by @git-diff-view/svelte's <DiffView> component
 */
export interface DiffViewData {
  oldFile: {
    fileName: string
    fileLang?: string
  }
  newFile: {
    fileName: string
    fileLang?: string
  }
  hunks: string[]
}

/**
 * Maps file extensions to language names for syntax highlighting
 * @param filename - The filename to extract language from
 * @returns Language name compatible with @git-diff-view
 */
export function getFileLanguage(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop() || ''

  const languageMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    rs: 'rust',
    svelte: 'svelte',
    css: 'css',
    json: 'json',
    md: 'markdown',
    html: 'html',
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'toml',
    py: 'python',
    go: 'go',
  }

  return languageMap[ext] || 'text'
}

/**
 * Transforms a PrFileDiff into the data format expected by @git-diff-view's <DiffView> component
 * @param file - The file diff from GitHub PR API
 * @returns DiffViewData compatible with @git-diff-view
 */
export function toGitDiffViewData(file: PrFileDiff): DiffViewData {
  // Determine old and new filenames (handles renames)
  const oldFileName = file.previous_filename || file.filename
  const newFileName = file.filename

  // Get language for syntax highlighting
  const oldFileLang = getFileLanguage(oldFileName)
  const newFileLang = getFileLanguage(newFileName)

  // Build hunks array from patch
  // If patch is null (binary files, renames without content), use empty array
  const hunks: string[] = file.patch
    ? [`--- a/${oldFileName}\n+++ b/${newFileName}\n${file.patch}`]
    : []

  return {
    oldFile: {
      fileName: oldFileName,
      fileLang: oldFileLang,
    },
    newFile: {
      fileName: newFileName,
      fileLang: newFileLang,
    },
    hunks,
  }
}
