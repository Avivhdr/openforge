import { render, screen, fireEvent } from '@testing-library/svelte'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { get } from 'svelte/store'
import GeneralCommentsSidebar from './GeneralCommentsSidebar.svelte'
import { selfReviewGeneralComments, selfReviewArchivedComments } from '../lib/stores'
import type { SelfReviewComment } from '../lib/types'

const mockGetActiveSelfReviewComments = vi.fn()
const mockGetArchivedSelfReviewComments = vi.fn()
const mockAddSelfReviewComment = vi.fn()
const mockDeleteSelfReviewComment = vi.fn()

vi.mock('../lib/ipc', () => ({
  getActiveSelfReviewComments: mockGetActiveSelfReviewComments,
  getArchivedSelfReviewComments: mockGetArchivedSelfReviewComments,
  addSelfReviewComment: mockAddSelfReviewComment,
  deleteSelfReviewComment: mockDeleteSelfReviewComment
}))

const mockComment: SelfReviewComment = {
  id: 1,
  task_id: 'task-1',
  comment_type: 'general',
  file_path: null,
  line_number: null,
  body: 'Test comment',
  created_at: Math.floor(Date.now() / 1000),
  round: 1
}

const mockArchivedComment: SelfReviewComment = {
  id: 2,
  task_id: 'task-1',
  comment_type: 'general',
  file_path: null,
  line_number: null,
  body: 'Archived comment',
  created_at: Math.floor(Date.now() / 1000) - 86400,
  round: 0
}

describe('GeneralCommentsSidebar', () => {
  beforeEach(() => {
    selfReviewGeneralComments.set([])
    selfReviewArchivedComments.set([])
    vi.clearAllMocks()
  })

  it('skips IPC calls when stores already have data', async () => {
    selfReviewGeneralComments.set([mockComment])
    selfReviewArchivedComments.set([mockArchivedComment])

    render(GeneralCommentsSidebar, { props: { taskId: 'task-1' } })

    await new Promise((r) => setTimeout(r, 50))

    expect(mockGetActiveSelfReviewComments).not.toHaveBeenCalled()
    expect(mockGetArchivedSelfReviewComments).not.toHaveBeenCalled()
  })

  it('calls IPC when stores are empty', async () => {
    mockGetActiveSelfReviewComments.mockResolvedValue([mockComment])
    mockGetArchivedSelfReviewComments.mockResolvedValue([mockArchivedComment])

    selfReviewGeneralComments.set([])
    selfReviewArchivedComments.set([])

    render(GeneralCommentsSidebar, { props: { taskId: 'task-1' } })

    await new Promise((r) => setTimeout(r, 100))

    expect(mockGetActiveSelfReviewComments).toHaveBeenCalledWith('task-1')
    expect(mockGetArchivedSelfReviewComments).toHaveBeenCalledWith('task-1')

    expect(get(selfReviewGeneralComments).length).toBe(1)
    expect(get(selfReviewArchivedComments).length).toBe(1)
  })

  it('forces reload when add comment is clicked', async () => {
    mockGetActiveSelfReviewComments.mockResolvedValue([mockComment])
    mockGetArchivedSelfReviewComments.mockResolvedValue([mockArchivedComment])
    mockAddSelfReviewComment.mockResolvedValue(undefined)

    selfReviewGeneralComments.set([mockComment])
    selfReviewArchivedComments.set([mockArchivedComment])

    vi.clearAllMocks()

    render(GeneralCommentsSidebar, { props: { taskId: 'task-1' } })

    await new Promise((r) => setTimeout(r, 50))

    expect(mockGetActiveSelfReviewComments).not.toHaveBeenCalled()

    const textarea = screen.getByPlaceholderText('Add a testing note… (Cmd+Enter to submit)')
    await fireEvent.change(textarea, { target: { value: 'New comment' } })

    const addButton = screen.getByText('Add')
    await fireEvent.click(addButton)

    await new Promise((r) => setTimeout(r, 100))

    expect(mockGetActiveSelfReviewComments).toHaveBeenCalled()
    expect(mockGetArchivedSelfReviewComments).toHaveBeenCalled()
  })

  it('renders empty state when no comments', async () => {
    mockGetActiveSelfReviewComments.mockResolvedValue([])
    mockGetArchivedSelfReviewComments.mockResolvedValue([])

    render(GeneralCommentsSidebar, { props: { taskId: 'task-1' } })

    await new Promise((r) => setTimeout(r, 100))

    expect(screen.getByText('No comments yet. Add notes from manual testing.')).toBeTruthy()
  })

  it('renders comments when stores have data', async () => {
    selfReviewGeneralComments.set([mockComment])
    selfReviewArchivedComments.set([mockArchivedComment])

    render(GeneralCommentsSidebar, { props: { taskId: 'task-1' } })

    await new Promise((r) => setTimeout(r, 50))

    expect(screen.getByText('Test comment')).toBeTruthy()
    expect(screen.getByText('Previous Round (1)')).toBeTruthy()
  })
})
