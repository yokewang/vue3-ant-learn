import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useAnalysisStore = defineStore('analysis', () => {
  const summary = ref('')
  const solution = ref('')
  const alert = ref('')
  const topos = ref([])
  const causeSummary = ref('')
  const causeDetail = ref('')

  return { summary, solution, alert, topos, causeSummary, causeDetail }
})
