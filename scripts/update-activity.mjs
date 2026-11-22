#!/usr/bin/env node
// Regenera assets/activity.svg con datos reales de GitHub.
// Lo ejecuta la GitHub Action .github/workflows/activity.yml una vez al día.
// Sin dependencias: Node 20+ (fetch nativo).
import { readFile, writeFile } from 'node:fs/promises'

const USER = process.env.PROFILE_USER || 'sebas-archive'
const TOKEN = process.env.GITHUB_TOKEN
const ROOT = new URL('..', import.meta.url)

// Mismos colores que la web (src/index.css)
const LEVELS = ['#1b2234', '#2b3a68', '#3f5ab1', '#5279ee', '#65d9ea']
const LANG_COLORS = ['#5F86FF', '#55D7E8', '#9B72FF', '#6D78F5', '#B8C5FF', '#313A63']

const escape = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

async function getJson(url, auth = false) {
  const headers = { 'User-Agent': `${USER}-profile-readme`, Accept: 'application/vnd.github+json' }
  if (auth && TOKEN) headers.Authorization = `Bearer ${TOKEN}`
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`)
  return res.json()
}

const github = (path) => getJson(`https://api.github.com${path}`, true)

// Contribuciones de los últimos 12 meses (misma fuente que usa la web)
const calendar = await getJson(`https://github-contributions-api.jogruber.de/v4/${USER}?y=last`)
const contributions = calendar.contributions
const total = calendar.total.lastYear

// Repositorios públicos y lenguajes publicados
const user = await github(`/users/${USER}`)
const repos = (await github(`/users/${USER}/repos?per_page=100&type=owner`)).filter((r) => !r.fork)
const bytes = {}
for (const repo of repos) {
  const langs = await github(`/repos/${repo.full_name}/languages`)
  for (const [name, size] of Object.entries(langs)) bytes[name] = (bytes[name] || 0) + size
}
const sum = Object.values(bytes).reduce((a, b) => a + b, 0) || 1
const languages = Object.entries(bytes)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 6)
  .map(([name, size]) => ({ name, pct: (size / sum) * 100 }))

const cells = contributions
  .map((c, i) => {
    const delay = Math.floor(i / 7) * 14
    return `<i class="cell" style="background-color: ${LEVELS[c.level] ?? LEVELS[0]};animation-delay: ${delay}ms;"></i>`
  })
  .join('')

let svg = await readFile(new URL('scripts/activity-template.svg', ROOT), 'utf8')
svg = svg
  .replace('{{TOTAL}}', escape(total))
  .replace('{{REPOS}}', escape(String(user.public_repos).padStart(2, '0')))
  .replace('{{HEATMAP}}', cells)
for (let i = 0; i < 6; i++) {
  const lang = languages[i] || { name: '—', pct: 0 }
  svg = svg
    .replaceAll(`{{LANG_${i}_NAME}}`, escape(lang.name))
    .replaceAll(`{{LANG_${i}_PCT}}`, `${lang.pct.toFixed(2)}%`)
    .replaceAll(`{{LANG_${i}_W}}`, lang.pct.toFixed(2))
    .replaceAll(`{{LANG_${i}_COLOR}}`, LANG_COLORS[i])
}

await writeFile(new URL('assets/activity.svg', ROOT), svg)
console.log(`activity.svg · ${total} contribuciones · ${user.public_repos} repos · ${languages.map((l) => `${l.name} ${l.pct.toFixed(2)}%`).join(', ')}`)
