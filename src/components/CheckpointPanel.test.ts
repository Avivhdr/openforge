import { render, screen } from '@testing-library/svelte'
import { describe, it, expect, vi } from 'vitest'
import CheckpointPanel from './CheckpointPanel.svelte'
import type { AgentSession } from '../lib/types'

vi.mock('../lib/ipc', () => ({
  approveCheckpoint: vi.fn(() => Promise.resolve()),
  rejectCheckpoint: vi.fn(() => Promise.resolve()),
}))

const pausedSession: AgentSession = {
  id: 'ses-1',
  ticket_id: 'PROJ-42',
  opencode_session_id: 'oc-123',
  stage: 'read_ticket',
  status: 'paused',
  checkpoint_data: 'Agent proposes: add auth middleware',
  error_message: null,
  created_at: 1000,
  updated_at: 2000,
}

describe('CheckpointPanel', () => {
  it('renders checkpoint data when paused', () => {
    render(CheckpointPanel, { props: { session: pausedSession } })
    expect(screen.getByText('Agent proposes: add auth middleware')).toBeTruthy()
    expect(screen.getByText(/After Reading Ticket/)).toBeTruthy()
  })

  it('renders approve and reject buttons', () => {
    render(CheckpointPanel, { props: { session: pausedSession } })
    expect(screen.getByText('Approve')).toBeTruthy()
    expect(screen.getByText('Reject')).toBeTruthy()
  })

  it('shows running message when session is running', () => {
    const runningSession: AgentSession = { ...pausedSession, status: 'running', checkpoint_data: null }
    render(CheckpointPanel, { props: { session: runningSession } })
    expect(screen.getByText('Agent is working...')).toBeTruthy()
  })

  it('shows completed message', () => {
    const completedSession: AgentSession = { ...pausedSession, status: 'completed', checkpoint_data: null }
    render(CheckpointPanel, { props: { session: completedSession } })
    expect(screen.getByText('Stage completed')).toBeTruthy()
  })

  it('shows error message when failed', () => {
    const failedSession: AgentSession = {
      ...pausedSession,
      status: 'failed',
      checkpoint_data: null,
      error_message: 'Build failed',
    }
    render(CheckpointPanel, { props: { session: failedSession } })
    expect(screen.getByText('Build failed')).toBeTruthy()
  })

  it('disables reject button when feedback is empty', () => {
    render(CheckpointPanel, { props: { session: pausedSession } })
    const rejectBtn = screen.getByText('Reject')
    expect(rejectBtn.hasAttribute('disabled')).toBe(true)
  })
})
