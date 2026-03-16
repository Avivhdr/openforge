<script lang="ts">
  import { onMount } from 'svelte'
  import { projects, activeProjectId, projectAttention } from '../lib/stores'
  import { getProjectAttention, reorderProjects } from '../lib/ipc'
  import type { ProjectAttention } from '../lib/types'

  interface Props {
    onNewProject?: () => void
  }

  let { onNewProject }: Props = $props()

  let draggedProjectId: string | null = $state(null)
  let dropTargetId: string | null = $state(null)

  onMount(async () => {
    try {
      const summaries = await getProjectAttention()
      const map = new Map<string, ProjectAttention>()
      for (const summary of summaries) {
        map.set(summary.project_id, summary)
      }
      $projectAttention = map
    } catch (e) {
      console.error('Failed to load project attention:', e)
    }
  })

  function selectProject(projectId: string) {
    $activeProjectId = projectId
  }

  function getAttentionStatus(projectId: string): { dot: string; text: string; color: string } {
    const attention = $projectAttention.get(projectId)
    if (!attention) {
      return { dot: 'bg-base-content/30', text: 'idle', color: 'text-base-content/50' }
    }
    if (attention.needs_input > 0) {
      return { dot: 'bg-warning', text: `${attention.needs_input} needs input`, color: 'text-warning' }
    }
    if (attention.running_agents > 0) {
      return { dot: 'bg-success animate-pulse', text: `${attention.running_agents} running`, color: 'text-success' }
    }
    if (attention.completed_agents > 0) {
      return { dot: 'bg-info', text: `${attention.completed_agents} completed`, color: 'text-info' }
    }
    if (attention.ci_failures > 0) {
      return { dot: 'bg-error', text: `${attention.ci_failures} CI failures`, color: 'text-error' }
    }
    return { dot: 'bg-base-content/30', text: 'idle', color: 'text-base-content/50' }
  }

  function handleDragStart(e: DragEvent, projectId: string) {
    draggedProjectId = projectId
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', projectId)
    }
  }

  function handleDragOver(e: DragEvent, projectId: string) {
    e.preventDefault()
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move'
    }
    if (draggedProjectId && projectId !== draggedProjectId) {
      dropTargetId = projectId
    }
  }

  function handleDragLeave() {
    dropTargetId = null
  }

  function handleDrop(e: DragEvent, targetProjectId: string) {
    e.preventDefault()
    dropTargetId = null
    if (!draggedProjectId || draggedProjectId === targetProjectId) return

    const currentProjects = $projects
    const dragIdx = currentProjects.findIndex(p => p.id === draggedProjectId)
    const dropIdx = currentProjects.findIndex(p => p.id === targetProjectId)
    if (dragIdx === -1 || dropIdx === -1) return

    const reordered = [...currentProjects]
    const [moved] = reordered.splice(dragIdx, 1)
    reordered.splice(dropIdx, 0, moved)

    $projects = reordered
    draggedProjectId = null

    const projectIds = reordered.map(p => p.id)
    reorderProjects(projectIds).catch((err: unknown) => {
      console.error('Failed to persist project order:', err)
    })
  }

  function handleDragEnd() {
    draggedProjectId = null
    dropTargetId = null
  }
</script>

<div class="w-48 shrink-0 h-full bg-base-300 border-r border-base-content/10 flex flex-col font-mono">
  <div class="h-12 px-3 flex items-center justify-between border-b border-base-content/10">
    <span class="font-mono text-[10px] text-secondary font-bold">PROJECTS</span>
    <button type="button" class="btn btn-ghost btn-xs" aria-label="Add project" onclick={() => onNewProject?.()}>
      +
    </button>
  </div>

  <div class="flex-1 overflow-y-auto">
    {#each $projects as project (project.id)}
      {@const status = getAttentionStatus(project.id)}
      {@const isActive = project.id === $activeProjectId}
      {@const isDragging = project.id === draggedProjectId}
      {@const isDropTarget = project.id === dropTargetId}

      <button
        type="button"
        class="w-full px-3 py-2 text-left border-l-2 transition-colors {isActive ? 'border-primary bg-base-100' : 'border-transparent hover:bg-base-200'} {isDragging ? 'opacity-40' : ''} {isDropTarget ? 'border-t-2 border-t-primary' : ''}"
        aria-current={isActive ? 'true' : undefined}
        draggable="true"
        ondragstart={(e: DragEvent) => handleDragStart(e, project.id)}
        ondragover={(e: DragEvent) => handleDragOver(e, project.id)}
        ondragleave={handleDragLeave}
        ondrop={(e: DragEvent) => handleDrop(e, project.id)}
        ondragend={handleDragEnd}
        onclick={() => selectProject(project.id)}
      >
        <div class="font-mono text-xs {isActive ? 'font-bold text-base-content' : 'font-medium text-base-content'}">{project.name}</div>
        <div class="mt-1 flex items-center gap-1.5">
          <span class="w-1.5 h-1.5 rounded-full {status.dot}"></span>
          <span class="font-mono text-[10px] {status.color}">{status.text}</span>
        </div>
      </button>
    {/each}
  </div>
</div>
