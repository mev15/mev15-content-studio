# Privacy notes

This repository contains no telemetry, analytics SDK, embedded credentials, private keys, access tokens, personal article drafts, or server configuration files.

## Local files

- `gzh-design` writes generated Markdown and HTML to the current workspace under `output/preview/<article-id>/` unless the user explicitly chooses another location.
- `qing-shiwu-illustrations` writes generated images beside the user-selected article according to its documented workflow.
- Neither skill scans unrelated directories by default.

## External services

- Image generation is performed only when the user requests it. Prompts and selected reference assets are processed by the image-generation service configured in the running Codex environment.
- Generated公众号 HTML may retain image URLs supplied by the user or public placeholder URLs used by theme examples. Review external URLs before publishing sensitive material.
- `gzh-publish` calls the official WeChat API (`api.weixin.qq.com`) only when the user explicitly runs it: it uploads article images and the cover, and creates a draft. It also downloads the image-host URLs referenced in the user-supplied HTML. WeChat AppID/AppSecret are read from environment variables only, are never written to disk or logs, and are sent to no host other than `api.weixin.qq.com`. Its `--dry-run` mode performs no network calls.
- The skills contain no background network uploader.

Do not provide private credentials, confidential drafts, or personal images unless the configured model provider and workspace are approved for that data.
