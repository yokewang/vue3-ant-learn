import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useAnalysisSampleStore = defineStore('analysis-sample', () => {
  // Default markdown contents (centralized here)
  const defaultSummary = `# Incident Summary\n\n- Title: <short incident title>\n- Time Window: <start> ~ <end> (timezone)\n- Impact: <affected users/scope/percentage/SLO>\n- Symptoms: <what users observed>\n- Current Status: <mitigated | monitoring | resolved>\n- Owner: <on-call/assignee>\n\n---\n\n## Details\nProvide a high-level overview of what happened and the business/user impact.`

  const defaultSolution = `# Remediation Plan\n\n## Immediate Actions\n1. Contain impact: <steps>\n2. Recover service: <steps>\n\n## Verification\n- Metrics validated: <list>\n- Logs checked: <list>\n\n## Rollback/Workaround\n- Rollback plan: <how>\n- Temporary workaround: <how>\n\n## Follow-ups\n- Owner: <name>\n- ETA: <date>`

  const defaultAlert = `# Alerts & Risks\n\n> Key risks and user communications go here.\n\n- SLO/SLA at risk: <which>\n- Potential blast radius: <which>\n- Customer comms: <channels and message>\n- On-call handoff notes: <what to watch>`

  const defaultCauseSummary = `# Root Cause Summary\n\nIn 2-3 sentences, concisely describe the root cause and the trigger, and why the system did not automatically recover.`

  const defaultCauseDetail = `# Root Cause Detail\n\n## 5 Whys\n1. Why 1: ...\n2. Why 2: ...\n3. Why 3: ...\n4. Why 4: ...\n5. Why 5: ...\n\n## Evidence\n- Metrics: <screenshots/indicators>\n- Logs: <snippets>\n- Config/Deploy: <changes>\n\n## Contributing Factors\n- Factor 1: ...\n- Factor 2: ...\n\n## Prevention\n- Action 1: ...\n- Action 2: ...`

  const defaultTopoSources = [
    `graph TD\n  A[Start] --> B{Check}\n  B -- Yes --> C[Do thing]\n  B -- No --> D[Skip]\n  C --> E[End]\n  D --> E[End]`,
    `sequenceDiagram\n  participant User\n  participant API\n  User->>API: Request\n  API-->>User: Response`,
  ]

  const defaultTopoNew = 'graph TD\n  Start --> End'

  // Reactive state initialized with defaults
  const summary = ref(defaultSummary)
  const solution = ref(defaultSolution)
  const alert = ref(defaultAlert)
  const topos = ref([...defaultTopoSources])
  const causeSummary = ref(defaultCauseSummary)
  const causeDetail = ref(defaultCauseDetail)

  function reset() {
    summary.value = defaultSummary
    solution.value = defaultSolution
    alert.value = defaultAlert
    topos.value = [...defaultTopoSources]
    causeSummary.value = defaultCauseSummary
    causeDetail.value = defaultCauseDetail
  }

  function addTopo() {
    topos.value.push(defaultTopoNew)
  }

  function removeTopoByIndex(index) {
    if (index >= 0 && index < topos.value.length) {
      topos.value.splice(index, 1)
    }
  }

  return {
    summary,
    solution,
    alert,
    topos,
    causeSummary,
    causeDetail,
    reset,
    addTopo,
    removeTopoByIndex,
  }
})
