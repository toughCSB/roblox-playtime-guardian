import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
const defaultPaths = [
  join('dist', `My Pact Setup ${packageJson.version}.exe`),
  join('dist', 'win-unpacked', 'My Pact.exe'),
]
const paths = process.argv.slice(2)
const targets = paths.length > 0 ? paths : defaultPaths

for (const path of targets) {
  if (!existsSync(path)) {
    console.error(`Missing artifact: ${path}`)
    process.exit(1)
  }
}

const ps = `
$ErrorActionPreference = 'Stop'
Get-Command Get-AuthenticodeSignature -ErrorAction Stop | Out-Null
$paths = @(${targets.map(path => `'${path.replace(/'/g, "''")}'`).join(',')})
$results = foreach ($p in $paths) {
  $sig = Get-AuthenticodeSignature -LiteralPath $p
  [pscustomobject]@{
    Path = $p
    Status = $sig.Status.ToString()
    Subject = if ($sig.SignerCertificate) { $sig.SignerCertificate.Subject } else { $null }
    Thumbprint = if ($sig.SignerCertificate) { $sig.SignerCertificate.Thumbprint } else { $null }
  }
}
$results | ConvertTo-Json -Depth 4
`

function runPowerShell(script) {
  const candidates = [
    { command: 'pwsh', args: ['-NoProfile', '-Command', script] },
    {
      command: 'powershell.exe',
      args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
    },
  ]

  let lastError
  for (const candidate of candidates) {
    try {
      return execFileSync(candidate.command, candidate.args, {
        encoding: 'utf8',
        windowsHide: true,
      })
    } catch (err) {
      lastError = err
      if (err.code !== 'ENOENT') break
    }
  }
  throw lastError
}

const output = runPowerShell(ps)

const parsed = JSON.parse(output)
const results = Array.isArray(parsed) ? parsed : [parsed]

let failed = false
for (const result of results) {
  if (result.Status !== 'Valid') {
    console.error(`Unsigned or invalid signature: ${result.Path} (${result.Status})`)
    failed = true
  } else {
    console.log(`Valid signature: ${result.Path}`)
    console.log(`  ${result.Subject}`)
  }
}

if (failed) process.exit(1)
