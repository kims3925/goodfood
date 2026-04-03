'use client'

import { useState, useCallback } from 'react'
import { Plus, Trash2, ArrowRight, Save, GitBranch } from 'lucide-react'

interface WorkflowStep {
  id: string
  agentId: string
  parallel: boolean
}

interface Workflow {
  id: string
  name: string
  triggerEvent: string
  steps: WorkflowStep[]
}

interface AgentOption {
  id: string
  displayName: string
}

interface WorkflowEditorProps {
  workflow: Workflow
  onSave: (workflow: Workflow) => void
  agents: AgentOption[]
}

let stepCounter = 0
function generateStepId() {
  stepCounter += 1
  return `step-${Date.now()}-${stepCounter}`
}

export default function WorkflowEditor({ workflow, onSave, agents }: WorkflowEditorProps) {
  const [editedWorkflow, setEditedWorkflow] = useState<Workflow>({ ...workflow, steps: [...workflow.steps] })

  const handleAddStep = useCallback(() => {
    setEditedWorkflow((prev) => ({
      ...prev,
      steps: [
        ...prev.steps,
        { id: generateStepId(), agentId: agents[0]?.id ?? '', parallel: false },
      ],
    }))
  }, [agents])

  const handleRemoveStep = useCallback((stepId: string) => {
    setEditedWorkflow((prev) => ({
      ...prev,
      steps: prev.steps.filter((s) => s.id !== stepId),
    }))
  }, [])

  const handleAgentChange = useCallback((stepId: string, agentId: string) => {
    setEditedWorkflow((prev) => ({
      ...prev,
      steps: prev.steps.map((s) => (s.id === stepId ? { ...s, agentId } : s)),
    }))
  }, [])

  const handleParallelToggle = useCallback((stepId: string) => {
    setEditedWorkflow((prev) => ({
      ...prev,
      steps: prev.steps.map((s) => (s.id === stepId ? { ...s, parallel: !s.parallel } : s)),
    }))
  }, [])

  const handleSave = useCallback(() => {
    onSave(editedWorkflow)
  }, [editedWorkflow, onSave])

  const getAgentName = (agentId: string) => {
    return agents.find((a) => a.id === agentId)?.displayName ?? 'Unknown'
  }

  return (
    <div className="bg-white border border-border rounded-lg shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-divider">
        <div className="flex items-center gap-2">
          <GitBranch className="text-primary-color" size={16} />
          <h3 className="text-sm font-semibold text-text-primary">
            Workflow: {editedWorkflow.name}
          </h3>
        </div>
        <button
          type="button"
          onClick={handleSave}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-primary-color rounded-md hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-color transition-colors duration-200"
        >
          <Save size={14} />
          Save
        </button>
      </div>

      <div className="p-4">
        {/* Trigger Event */}
        <div className="flex items-center gap-2 mb-6">
          <span className="inline-flex items-center px-3 py-1.5 rounded-md text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">
            Trigger: {editedWorkflow.triggerEvent}
          </span>
          <ArrowRight className="text-gray-400" size={16} />
        </div>

        {/* Steps */}
        <div className="space-y-3">
          {editedWorkflow.steps.map((step, index) => (
            <div key={step.id} className="flex items-center gap-3">
              {/* Step number */}
              <span className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-text-secondary">
                {index + 1}
              </span>

              {/* Arrow from previous */}
              {index > 0 && (
                <ArrowRight className="shrink-0 text-gray-300" size={14} />
              )}

              {/* Step config */}
              <div className="flex items-center gap-2 flex-1 p-3 border border-border rounded-lg bg-gray-50">
                {/* Agent select */}
                <select
                  value={step.agentId}
                  onChange={(e) => handleAgentChange(step.id, e.target.value)}
                  className="flex-1 px-2 py-1.5 text-sm border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary-color focus:border-transparent"
                >
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.displayName}
                    </option>
                  ))}
                </select>

                {/* Parallel toggle */}
                <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={step.parallel}
                    onChange={() => handleParallelToggle(step.id)}
                    className="h-4 w-4 rounded border-gray-300 text-primary-color focus:ring-primary-color"
                  />
                  <span className="text-xs text-text-secondary whitespace-nowrap">Parallel</span>
                </label>

                {/* Remove button */}
                <button
                  type="button"
                  onClick={() => handleRemoveStep(step.id)}
                  className="shrink-0 p-1 text-gray-400 hover:text-red-500 rounded transition-colors duration-150 focus:outline-none"
                  aria-label={`Remove step ${index + 1}: ${getAgentName(step.agentId)}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Add Step Button */}
        <button
          type="button"
          onClick={handleAddStep}
          disabled={agents.length === 0}
          className="mt-4 inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-primary-color border border-dashed border-primary-color rounded-md hover:bg-primary-light transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-color disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus size={14} />
          Add Step
        </button>
      </div>
    </div>
  )
}
