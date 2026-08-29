# ShareFile sandbox spike

Status: sandbox-only adapter behind the existing provider factory. Not production. Not deployed.

`DOCUMENT_STORAGE_PROVIDER` may be `sandbox_mock` (default, network-free) or `sharefile`.

ShareFile activation still requires:

- `SANDBOX_MODE=true`
- `PRODUCTION_INTEGRATIONS_ENABLED=false`

## Environment

Server-only. Never use `NEXT_PUBLIC_` for these values. Never store them in Supabase.

```
SHAREFILE_CLIENT_ID=
SHAREFILE_CLIENT_SECRET=
SHAREFILE_REFRESH_TOKEN=
SHAREFILE_SUBDOMAIN=
SHAREFILE_API_CONTROL_PLANE=sharefile.com
SHAREFILE_ROOT_FOLDER_ID=
```

`SHAREFILE_API_CONTROL_PLANE` defaults to `sharefile.com` if omitted.

Obtain the first refresh token with ShareFile’s authorization-code OAuth flow (not the deprecated password grant). Put that refresh token in `.env.local`. The app refreshes access tokens in memory only.

If ShareFile rotates the refresh token, update `.env.local`. The process keeps the latest refresh token in memory until restart.

## Current ShareFile upload mechanism

From ShareFile API v3 `Items` documentation:

1. Server calls `POST /sf/v3/Items({folderId})/Upload2` with `Method=standard`, `Raw=true`, `FileName`, and `FileSize`.
2. ShareFile returns an `UploadSpecification` whose `ChunkUri` is the URI the client must POST file bytes to.
3. The browser POSTs the test file body to `ChunkUri`. Pillar does not proxy those bytes.
4. Completion looks up the file in the destination folder by name and stores the ShareFile item id as `external_file_id`.

Temporary view uses `GET /sf/v3/Items({id})/Download?redirect=false`, which returns a `DownloadSpecification`.

## CORS / trusted-domain requirement

ShareFile’s current Upload Specification documents `ChunkUri` as the upload target. It does **not** document CORS headers or a trusted-web-origin setting for browser `fetch()` from this app.

A browser POST to `ChunkUri` from `http://localhost:3000` will likely require ShareFile/storage-host CORS (or an equivalent trusted-domain allowlist) for this origin.

If that POST is blocked, do **not** add a Next.js byte proxy. Configure the ShareFile account / upload host to allow this origin, or keep `DOCUMENT_STORAGE_PROVIDER=sandbox_mock` until that is available.

## Folder layout

Root folder = `SHAREFILE_ROOT_FOLDER_ID` (create “Pillar Deal Room Sandbox” once in ShareFile).

```
Pillar Deal Room Sandbox
  / PDR-SBX-001
      / Client Needs
      / Miscellaneous
```

Folder creation is idempotent: list children by name, create only if missing. Folder ids are not shown in the UI.

## What Pillar stores

Metadata and the ShareFile item id only. No file bytes. No OAuth tokens. No upload/download URLs in `activity_log`.
