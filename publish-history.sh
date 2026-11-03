#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
    cat <<'EOF'
Usage:
  ./publish-history.sh <github-repository-url>
  ./publish-history.sh <github-repository-url> --dry-run

Publishes the reconstructed version commits, tags, changelogs, and Windows
builds in order. The first missing release is immediate; later releases are
spaced at least five minutes apart.
EOF
}

fail() {
    printf 'Error: %s\n' "$*" >&2
    exit 1
}

[[ $# -ge 1 && $# -le 2 ]] || { usage >&2; exit 2; }
repository_url=$1
dry_run=false
if [[ $# -eq 2 ]]; then
    [[ $2 == "--dry-run" ]] || { usage >&2; exit 2; }
    dry_run=true
fi

if [[ $repository_url =~ ^https://github\.com/([^/]+)/([^/?#]+)$ ]]; then
    owner=${BASH_REMATCH[1]}
    repository=${BASH_REMATCH[2]%.git}
elif [[ $repository_url =~ ^git@github\.com:([^/]+)/([^/]+)$ ]]; then
    owner=${BASH_REMATCH[1]}
    repository=${BASH_REMATCH[2]%.git}
else
    fail "Use a GitHub URL like https://github.com/owner/repository or git@github.com:owner/repository.git."
fi
repository_slug="$owner/$repository"

project_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
cd "$project_root"

command -v git >/dev/null || fail "Git was not found in Git Bash."
command -v gh >/dev/null || fail "GitHub CLI (gh) was not found. Install it and restart Git Bash."
[[ $(git branch --show-current) == main ]] || fail "Check out the main branch before publishing."
[[ -z $(git status --porcelain --untracked-files=all) ]] || fail "Commit or resolve all working-tree changes first."

mapfile -t version_tags < <(
    git tag --list 'v[0-9]*' |
        grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' |
        sort -V
)
[[ ${#version_tags[@]} -gt 0 ]] || fail "No version tags such as v1.0.0 were found."

declare -A release_commits=()
previous_commit=""
for tag in "${version_tags[@]}"; do
    [[ $(git cat-file -t "refs/tags/$tag") == tag ]] || fail "$tag must be an annotated tag."
    version=${tag#v}
    commit=$(git rev-parse "$tag^{commit}")
    release_commits["$tag"]=$commit

    if [[ -n $previous_commit ]]; then
        [[ $(git rev-parse "$commit^") == "$previous_commit" ]] ||
            fail "$tag is not the next direct release commit after the preceding version."
    fi

    for path in \
        "versions/$version/CHANGELOG.md" \
        "versions/$version/source/package.json" \
        "versions/$version/source/src/main.js" \
        "build/versions/$version/Games Widget $version.exe"; do
        [[ -f $path ]] || fail "Required release file is missing: $path"
    done

    snapshot_version=$(node -p "require('./versions/$version/source/package.json').version")
    [[ $snapshot_version == "$version" ]] || fail "$tag does not match its recovered package version."
    previous_commit=$commit
done

head_commit=$(git rev-parse HEAD)
git merge-base --is-ancestor "$previous_commit" "$head_commit" ||
    fail "The current main branch does not contain the latest release commit."
latest_tag=${version_tags[${#version_tags[@]} - 1]}

if [[ $dry_run == false ]]; then
    gh auth status --hostname github.com >/dev/null ||
        fail "Authenticate with GitHub CLI first: gh auth login"
fi

remote_output=$(git ls-remote --refs "$repository_url") ||
    fail "Could not read the GitHub repository. Check the URL and your Git credentials."
declare -A remote_refs=()
while IFS=$'\t' read -r object_id ref; do
    [[ -n ${ref:-} ]] && remote_refs["$ref"]=$object_id
done <<< "$remote_output"

for ref in "${!remote_refs[@]}"; do
    allowed=false
    [[ $ref == refs/heads/main ]] && allowed=true
    for tag in "${version_tags[@]}"; do
        [[ $ref == "refs/tags/$tag" ]] && allowed=true
    done
    [[ $allowed == true ]] || fail "Unexpected remote ref '$ref'; refusing to overwrite unrelated history."
done

main_commit_index=-1
if [[ -n ${remote_refs[refs/heads/main]:-} ]]; then
    remote_main=${remote_refs[refs/heads/main]}
    if [[ $remote_main == "$head_commit" ]]; then
        main_commit_index=$((${#version_tags[@]} - 1))
    else
        for index in "${!version_tags[@]}"; do
            tag=${version_tags[$index]}
            if [[ $remote_main == "${release_commits[$tag]}" ]]; then
                main_commit_index=$index
                break
            fi
        done
        (( main_commit_index >= 0 )) ||
            fail "Remote main does not match a known release commit; refusing to overwrite or merge it."
    fi
fi

remote_tag_indexes=()
for index in "${!version_tags[@]}"; do
    tag=${version_tags[$index]}
    ref="refs/tags/$tag"
    if [[ -n ${remote_refs[$ref]:-} ]]; then
        [[ ${remote_refs[$ref]} == "$(git rev-parse "$ref")" ]] ||
            fail "The remote tag $tag differs from the local annotated tag."
        remote_tag_indexes+=("$index")
    fi
done
for position in "${!remote_tag_indexes[@]}"; do
    [[ ${remote_tag_indexes[$position]} -eq $position ]] ||
        fail "Remote release tags are not a chronological prefix of the local versions."
done
((${#remote_tag_indexes[@]} <= main_commit_index + 1)) ||
    fail "The remote has a version tag whose commit is not published to main."

remote_release_output=$(gh release list --repo "$repository_slug" --limit 1000 --json tagName) ||
    fail "Could not list releases for $repository_slug."
mapfile -t remote_release_tags < <(
    if [[ -n $remote_release_output ]]; then
        node -e 'for (const r of JSON.parse(process.argv[1])) console.log(r.tagName)' "$remote_release_output" |
            sort -V
    fi
)

(( ${#remote_release_tags[@]} <= ${#version_tags[@]} )) ||
    fail "GitHub has releases that are outside this version sequence."
for position in "${!remote_release_tags[@]}"; do
    [[ ${remote_release_tags[$position]} == "${version_tags[$position]}" ]] ||
        fail "Existing GitHub Releases are not a chronological prefix of the local versions."
done

if [[ $dry_run == true ]]; then
    printf 'Dry run for %s. No remote changes will be made.\n' "$repository_slug"
    if [[ -n ${remote_refs[refs/heads/main]:-} ]]; then
        printf 'Remote main: %s\n' "$(git describe --tags --exact-match "${remote_refs[refs/heads/main]}" 2>/dev/null || echo 'commit not at a version tag')"
    else
        printf 'Remote main: empty\n'
    fi
    printf 'Existing version tags:'
    found_tag=false
    for tag in "${version_tags[@]}"; do
        if [[ -n ${remote_refs[refs/tags/$tag]:-} ]]; then
            printf ' %s' "$tag"
            found_tag=true
        fi
    done
    if [[ $found_tag == false ]]; then
        printf ' none'
    fi
    printf '\n'
    if ((${#remote_release_tags[@]})); then
        printf 'Existing GitHub Releases: %s\n' "${remote_release_tags[*]}"
    else
        printf 'Existing GitHub Releases: none\n'
    fi

    planned_release=false
    for index in "${!version_tags[@]}"; do
        tag=${version_tags[$index]}
        version=${tag#v}
        ref="refs/tags/$tag"
        release_exists=false
        for existing_tag in "${remote_release_tags[@]}"; do
            [[ $existing_tag == "$tag" ]] && release_exists=true
        done

        actions=()
        if (( index > main_commit_index )); then
            actions+=("push commit to main")
        fi
        if [[ -z ${remote_refs[$ref]:-} ]]; then
            actions+=("push tag")
        fi
        if [[ $release_exists == false ]]; then
            if [[ $planned_release == true || ${#remote_release_tags[@]} -gt 0 ]]; then
                actions+=("wait 5 minutes, then create GitHub Release with exe and changelog")
            else
                actions+=("create GitHub Release with exe and changelog (first pending release is immediate)")
            fi
            planned_release=true
        fi

        if ((${#actions[@]})); then
            printf 'Would %s: %s.\n' "$tag" "$(IFS='; '; echo "${actions[*]}")"
        else
            printf 'Would skip %s: commit, tag, and release already published.\n' "$tag"
        fi
    done

    if [[ $head_commit != "${release_commits[$latest_tag]}" && ${remote_refs[refs/heads/main]:-} != "$head_commit" ]]; then
        printf 'Would finally push the repository documentation commit to main.\n'
    fi
    exit 0
fi

next_release_index=0
has_published_release=false
((${#remote_release_tags[@]} > 0)) && has_published_release=true

for index in "${!version_tags[@]}"; do
    tag=${version_tags[$index]}
    version=${tag#v}
    commit=${release_commits[$tag]}
    ref="refs/tags/$tag"

    release_exists=false
    for existing_tag in "${remote_release_tags[@]}"; do
        [[ $existing_tag == "$tag" ]] && release_exists=true
    done

    if [[ $has_published_release == true && $release_exists == false ]]; then
        printf 'Waiting five minutes before publishing %s...\n' "$tag"
        sleep 300
    fi

    if (( index > main_commit_index )); then
        printf 'Publishing %s commit to main...\n' "$tag"
        git push "$repository_url" "$commit:refs/heads/main"
        main_commit_index=$index
    fi

    if [[ -z ${remote_refs[$ref]:-} ]]; then
        printf 'Publishing tag %s...\n' "$tag"
        git push "$repository_url" "$ref:$ref"
        remote_refs["$ref"]=$(git rev-parse "$ref")
    fi

    if [[ $release_exists == false ]]; then
        asset="build/versions/$version/Games Widget $version.exe"
        notes="versions/$version/CHANGELOG.md"
        printf 'Creating GitHub Release %s...\n' "$tag"
        gh release create "$tag" "$asset" \
            --repo "$repository_slug" \
            --title "Games Widget $version" \
            --notes-file "$notes"

        release_info=$(gh release view "$tag" --repo "$repository_slug" --json tagName,assets \
            --jq '.tagName + " " + ([.assets[].name] | join(","))')
        [[ $release_info == *"Games Widget $version.exe"* ]] ||
            fail "Release $tag was not verified with its executable asset."
        remote_release_tags+=("$tag")
        has_published_release=true
    fi

    printf 'Finished %s.\n' "$tag"
done

if [[ $head_commit != "${release_commits[$latest_tag]}" ]]; then
    if [[ ${remote_refs[refs/heads/main]:-} != "$head_commit" ]]; then
        printf 'Publishing final repository documentation commit...\n'
        git push "$repository_url" "$head_commit:refs/heads/main"
    fi
fi

printf 'All %s version releases are published to %s.\n' "${#version_tags[@]}" "$repository_slug"
