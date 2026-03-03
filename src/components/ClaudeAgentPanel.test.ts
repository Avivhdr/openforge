import { render, screen } from '@testing-library/svelte'
import { describe, it, expect } from 'vitest'
import ClaudeAgentPanel from './ClaudeAgentPanel.svelte'

describe('ClaudeAgentPanel', () => {
  it('renders stub message', () => {
    render(ClaudeAgentPanel, { props: { taskId: 'T-1' } })
    expect(screen.getByText(/Claude PTY terminal/)).toBeTruthy()
  })
})
