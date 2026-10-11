// Upload exactly the release assets pinned by the build, including opening media.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const manifest = JSON.parse(readFileSync(new URL('./release-media.json', import.meta.url)));
execFileSync('gh', ['release', 'upload', manifest.release,
  ...Object.keys(manifest.files).map(path => `public/${path}`),
  '--repo', manifest.repo, '--clobber'], { stdio: 'inherit' });
