# Version history

Each numbered folder contains a version-specific `CHANGELOG.md` and a
`source/` snapshot recovered from that build's packaged Electron application.
The source snapshots make the progression reviewable in GitHub; the matching
Windows executables remain under the Git-ignored `build/versions/<version>/`
directory and should be uploaded as assets to GitHub Releases.

The snapshots were extracted from the installers for 1.0.0 through 1.1.3 and
compared file by file. They contain the app files and assets packaged in each
build, not the original Git commits or complete development workspace.
`node_modules` and `package-lock.json` are not included; use the top-level
`package.json` in each snapshot to identify its declared dependencies.

The changelogs combine those source comparisons with the development history
provided for this project. They describe the meaningful user-facing changes
between builds, including features that were later removed. Keep adding a
matching source snapshot and changelog for future iterations.
