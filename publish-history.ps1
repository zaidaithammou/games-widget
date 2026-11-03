param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string] $RepositoryUrl,

    [switch] $DryRun
)

$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
$releaseIntervalSeconds = 300

function Invoke-Git {
    param(
        [Parameter(Mandatory = $true)]
        [string[]] $Arguments,
        [switch] $Capture
    )

    if ($Capture) {
        $output = & git -C $projectRoot @Arguments 2>&1
        if ($LASTEXITCODE -ne 0) {
            throw "git $($Arguments -join ' ') failed: $($output -join [Environment]::NewLine)"
        }
        return ($output -join [Environment]::NewLine).Trim()
    }

    & git -C $projectRoot @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "git $($Arguments -join ' ') failed with exit code $LASTEXITCODE."
    }
}

function Invoke-Gh {
    param(
        [Parameter(Mandatory = $true)]
        [string[]] $Arguments,
        [switch] $Capture
    )

    if ($Capture) {
        $output = & gh @Arguments 2>&1
        if ($LASTEXITCODE -ne 0) {
            throw "gh $($Arguments -join ' ') failed: $($output -join [Environment]::NewLine)"
        }
        return ($output -join [Environment]::NewLine).Trim()
    }

    & gh @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "gh $($Arguments -join ' ') failed with exit code $LASTEXITCODE."
    }
}

function Get-RemoteRefs {
    $output = Invoke-Git -Arguments @('ls-remote', '--refs', $remoteUrl) -Capture
    $refs = @{}
    if (-not $output) {
        return $refs
    }

    foreach ($line in ($output -split "`r?`n")) {
        if ($line -match '^([0-9a-f]+)\s+(.+)$') {
            $refs[$Matches[2]] = $Matches[1]
        }
    }
    return $refs
}

if ($RepositoryUrl -match '^https://github\.com/([^/]+)/([^/?#]+?)(?:\.git)?/?$') {
    $repositorySlug = "$($Matches[1])/$($Matches[2])"
    $remoteUrl = "https://github.com/$repositorySlug.git"
} elseif ($RepositoryUrl -match '^git@github\.com:([^/]+)/([^/]+?)(?:\.git)?$') {
    $repositorySlug = "$($Matches[1])/$($Matches[2])"
    $remoteUrl = "git@github.com:$repositorySlug.git"
} else {
    throw 'Provide a GitHub repository URL such as https://github.com/owner/repository or git@github.com:owner/repository.git.'
}

$branch = Invoke-Git -Arguments @('branch', '--show-current') -Capture
if ($branch -ne 'main') {
    throw "Run this from the project's main branch; the current branch is '$branch'."
}

$status = Invoke-Git -Arguments @('status', '--porcelain', '--untracked-files=all') -Capture
if ($status) {
    throw "The working tree must be clean before publishing. Commit or resolve these changes first:`n$status"
}

$localTagOutput = Invoke-Git -Arguments @('tag', '--list', 'v[0-9]*') -Capture
$versionTags = @($localTagOutput -split "`r?`n" |
    Where-Object { $_ -match '^v\d+\.\d+\.\d+$' } |
    Sort-Object { [version]($_ -replace '^v', '') })
if ($versionTags.Count -eq 0) {
    throw 'No version tags such as v1.0.0 were found.'
}

$releaseCommits = @{}
$previousCommit = $null
foreach ($tag in $versionTags) {
    $tagObjectType = Invoke-Git -Arguments @('cat-file', '-t', "refs/tags/$tag") -Capture
    if ($tagObjectType -ne 'tag') {
        throw "$tag must be an annotated Git tag."
    }

    $version = $tag -replace '^v', ''
    $commit = Invoke-Git -Arguments @('rev-parse', "$tag^{commit}") -Capture
    $releaseCommits[$tag] = $commit
    if ($previousCommit) {
        $parent = Invoke-Git -Arguments @('rev-parse', "$commit^") -Capture
        if ($parent -ne $previousCommit) {
            throw "$tag is not the next direct release commit after the preceding version."
        }
    }

    foreach ($path in @(
        "versions\$version\CHANGELOG.md",
        "versions\$version\source\package.json",
        "versions\$version\source\src\main.js",
        "build\versions\$version\Games Widget $version.exe"
    )) {
        if (-not (Test-Path -LiteralPath (Join-Path $projectRoot $path) -PathType Leaf)) {
            throw "Required version file is missing: $path"
        }
    }

    $packageJson = Get-Content -LiteralPath (Join-Path $projectRoot "versions\$version\source\package.json") -Raw | ConvertFrom-Json
    if ($packageJson.version -ne $version) {
        throw "$tag does not match the package version in its recovered source snapshot."
    }
    $previousCommit = $commit
}

$head = Invoke-Git -Arguments @('rev-parse', 'HEAD') -Capture
Invoke-Git -Arguments @('merge-base', '--is-ancestor', $previousCommit, $head)

if ($DryRun) {
    Write-Host "Dry run for $repositorySlug. The first release is immediate; later releases are spaced 5 minutes apart."
    foreach ($tag in $versionTags) {
        Write-Host "Would push $tag to main, then create its GitHub Release with the matching executable and changelog."
    }
    Write-Host 'Would then push the current repository documentation commit. No remote changes were made.'
    return
}

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    throw 'GitHub CLI (gh) is required to create releases. Install it and authenticate with: gh auth login'
}

Invoke-Gh -Arguments @('auth', 'status', '--hostname', 'github.com')
$remoteNameOutput = Invoke-Git -Arguments @('remote') -Capture
$remoteNames = @($remoteNameOutput -split "`r?`n" | Where-Object { $_ })
if ('origin' -in $remoteNames) {
    $existingRemote = Invoke-Git -Arguments @('remote', 'get-url', 'origin') -Capture
    if ($existingRemote -ne $remoteUrl) {
        throw "The existing origin URL does not match the supplied GitHub repository: $existingRemote"
    }
} else {
    Invoke-Git -Arguments @('remote', 'add', 'origin', $remoteUrl)
}

$remoteRefs = Get-RemoteRefs
$allowedRefs = @('refs/heads/main') + @($versionTags | ForEach-Object { "refs/tags/$_" })
$unexpectedRefs = @($remoteRefs.Keys | Where-Object { $_ -notin $allowedRefs })
if ($unexpectedRefs.Count -gt 0) {
    throw "The destination has unexpected Git refs. Use an empty repository or inspect it manually first: $($unexpectedRefs -join ', ')"
}

$mainCommitIndex = -1
if ($remoteRefs.ContainsKey('refs/heads/main')) {
    $remoteMain = $remoteRefs['refs/heads/main']
    if ($remoteMain -eq $head) {
        $mainCommitIndex = $versionTags.Count - 1
    } else {
        for ($i = 0; $i -lt $versionTags.Count; $i++) {
            if ($remoteMain -eq $releaseCommits[$versionTags[$i]]) {
                $mainCommitIndex = $i
                break
            }
        }
        if ($mainCommitIndex -lt 0) {
            throw 'Remote main does not match an expected release commit. Refusing to overwrite or merge remote history.'
        }
    }
}

$remoteTagIndexes = @()
foreach ($tag in $versionTags) {
    $ref = "refs/tags/$tag"
    if ($remoteRefs.ContainsKey($ref)) {
        $localTagObject = Invoke-Git -Arguments @('rev-parse', $ref) -Capture
        if ($remoteRefs[$ref] -ne $localTagObject) {
            throw "The remote tag $tag differs from the local annotated tag."
        }
        $remoteTagIndexes += [array]::IndexOf($versionTags, $tag)
    }
}
for ($i = 0; $i -lt $remoteTagIndexes.Count; $i++) {
    if ($remoteTagIndexes[$i] -ne $i) {
        throw 'Remote release tags are not a chronological prefix of the local versions.'
    }
}
if ($remoteTagIndexes.Count -gt ($mainCommitIndex + 1)) {
    throw 'The remote has a version tag whose commit has not been published to main.'
}

$remoteReleaseOutput = Invoke-Gh -Arguments @('release', 'list', '--repo', $repositorySlug, '--limit', '1000', '--json', 'tagName') -Capture
$remoteReleaseTags = @()
if ($remoteReleaseOutput) {
    $remoteReleaseTags = @($remoteReleaseOutput | ConvertFrom-Json |
        ForEach-Object { $_.tagName } |
        Sort-Object { [version]($_ -replace '^v', '') })
}
$unexpectedReleases = @($remoteReleaseTags | Where-Object { $_ -notin $versionTags })
if ($unexpectedReleases.Count -gt 0) {
    throw "The repository already has releases outside this version sequence: $($unexpectedReleases -join ', ')"
}
for ($i = 0; $i -lt $remoteReleaseTags.Count; $i++) {
    if ($remoteReleaseTags[$i] -ne $versionTags[$i]) {
        throw 'Existing GitHub Releases are not a chronological prefix of the local versions.'
    }
}

$nextIndex = 0
$hasPreviouslyPublishedRelease = $remoteReleaseTags.Count -gt 0
while ($nextIndex -lt $versionTags.Count) {
    $tag = $versionTags[$nextIndex]
    $version = $tag -replace '^v', ''
    $commit = $releaseCommits[$tag]
    $tagRef = "refs/tags/$tag"

    if ($nextIndex -gt $mainCommitIndex) {
        Write-Host "Publishing $tag commit to main..."
        Invoke-Git -Arguments @('push', 'origin', "$commit`:refs/heads/main")
        $mainCommitIndex = $nextIndex
    }

    if (-not $remoteRefs.ContainsKey($tagRef)) {
        Write-Host "Publishing $tag..."
        Invoke-Git -Arguments @('push', 'origin', "$tagRef`:$tagRef")
        $remoteRefs[$tagRef] = Invoke-Git -Arguments @('rev-parse', $tagRef) -Capture
    }

    if ($tag -notin $remoteReleaseTags) {
        if ($hasPreviouslyPublishedRelease) {
            Write-Host 'Waiting 5 minutes before publishing the next version...'
            Start-Sleep -Seconds $releaseIntervalSeconds
        }

        $asset = Join-Path $projectRoot "build\versions\$version\Games Widget $version.exe"
        $notes = Join-Path $projectRoot "versions\$version\CHANGELOG.md"
        Write-Host "Creating GitHub Release $tag with its Windows executable..."
        Invoke-Gh -Arguments @(
            'release', 'create', $tag, $asset,
            '--repo', $repositorySlug,
            '--title', "Games Widget $version",
            '--notes-file', $notes
        )
        $remoteReleaseTags += $tag
        $hasPreviouslyPublishedRelease = $true
    }

    Write-Host "Finished $tag."
    $nextIndex++
}

if ($head -ne $releaseCommits[$versionTags[-1]]) {
    $remoteMain = $remoteRefs['refs/heads/main']
    if ($remoteMain -ne $head) {
        Write-Host 'Publishing the final repository documentation commit...'
        Invoke-Git -Arguments @('push', 'origin', "$head`:refs/heads/main")
    }
}

Write-Host "All $($versionTags.Count) versioned commits, tags, and GitHub Releases have been published to $repositorySlug."
