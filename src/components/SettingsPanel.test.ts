import { render, screen } from '@testing-library/svelte'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import SettingsPanel from './SettingsPanel.svelte'
import { activeProjectId, projects } from '../lib/stores'

vi.mock('../lib/ipc', () => ({
  getProjectConfig: vi.fn(),
  setProjectConfig: vi.fn(),
  updateProject: vi.fn(),
  deleteProject: vi.fn(),
}))

import { getProjectConfig } from '../lib/ipc'

describe('SettingsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getProjectConfig).mockResolvedValue('')
    activeProjectId.set('test-project-id')
    projects.set([
      {
        id: 'test-project-id',
        name: 'Test Project',
        path: '/tmp/test',
        created_at: Date.now(),
        updated_at: Date.now(),
      },
    ])
  })

  it('does not render JIRA credential fields', () => {
    render(SettingsPanel)
    
    expect(screen.queryByPlaceholderText('https://your-domain.atlassian.net')).toBeNull()
    expect(screen.queryByPlaceholderText('your@email.com')).toBeNull()
    expect(screen.queryByPlaceholderText('Your JIRA API token')).toBeNull()
  })

  it('does not render GitHub PAT field', () => {
    render(SettingsPanel)
    
    expect(screen.queryByPlaceholderText('ghp_...')).toBeNull()
  })

  it('renders Board ID field', () => {
    render(SettingsPanel)
    
    expect(screen.getByPlaceholderText('e.g. PROJ')).toBeTruthy()
  })

  it('renders Default Repository field', () => {
    render(SettingsPanel)
    
    expect(screen.getByPlaceholderText('owner/repo')).toBeTruthy()
  })

  it('renders project name field', () => {
    render(SettingsPanel)
    
    expect(screen.getByPlaceholderText('My Project')).toBeTruthy()
  })
})
