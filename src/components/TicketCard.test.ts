import { render, screen, fireEvent } from '@testing-library/svelte'
import { describe, it, expect } from 'vitest'
import TicketCard from './TicketCard.svelte'
import type { Ticket, AgentSession } from '../lib/types'

const baseTicket: Ticket = {
  id: 'PROJ-42',
  title: 'Implement auth middleware',
  description: 'Add JWT auth to API routes',
  status: 'todo',
  jira_status: 'To Do',
  assignee: 'Alice',
  created_at: 1000,
  updated_at: 2000,
  acceptance_criteria: null,
  plan_text: null,
}

describe('TicketCard', () => {
  it('renders ticket id and title', () => {
    render(TicketCard, { props: { ticket: baseTicket } })
    expect(screen.getByText('PROJ-42')).toBeTruthy()
    expect(screen.getByText('Implement auth middleware')).toBeTruthy()
  })

  it('renders assignee', () => {
    render(TicketCard, { props: { ticket: baseTicket } })
    expect(screen.getByText('Alice')).toBeTruthy()
  })

  it('shows running status when session is running', () => {
    const session: AgentSession = {
      id: 'ses-1',
      ticket_id: 'PROJ-42',
      opencode_session_id: null,
      stage: 'implement',
      status: 'running',
      checkpoint_data: null,
      error_message: null,
      created_at: 1000,
      updated_at: 2000,
    }
    render(TicketCard, { props: { ticket: baseTicket, session } })
    expect(screen.getByText('Implementing...')).toBeTruthy()
  })

  it('shows paused status for checkpoint', () => {
    const session: AgentSession = {
      id: 'ses-1',
      ticket_id: 'PROJ-42',
      opencode_session_id: null,
      stage: 'read_ticket',
      status: 'paused',
      checkpoint_data: '{}',
      error_message: null,
      created_at: 1000,
      updated_at: 2000,
    }
    render(TicketCard, { props: { ticket: baseTicket, session } })
    expect(screen.getByText('Awaiting approval')).toBeTruthy()
  })

  it('dispatches select event on click', async () => {
    const { component } = render(TicketCard, { props: { ticket: baseTicket } })
    let selectedId = ''
    component.$on('select', (e: CustomEvent<string>) => {
      selectedId = e.detail
    })
    const card = screen.getByRole('button')
    await fireEvent.click(card)
    expect(selectedId).toBe('PROJ-42')
  })
})
