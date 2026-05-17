<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/assets/logo-dark.png">
    <img src=".github/assets/logo-light.png" alt="Flui" width="120">
  </picture>
</p>
<h1 align="center">Flui Dashboard</h1>

<p align="center">
  <strong>The web console for independent cloud.</strong>
</p>
<p align="center">
  <em>Open source. Multi-provider. Yours to own and run.</em>
</p>
<p align="center">
  <a href="LICENSE"><img alt="License: AGPL-3.0" src="https://img.shields.io/badge/license-AGPL--3.0-blue.svg"></a>
  <a href="https://github.com/flui-cloud/flui.dashboard/actions/workflows/docker-publish.yml"><img alt="Build" src="https://github.com/flui-cloud/flui.dashboard/actions/workflows/docker-publish.yml/badge.svg"></a>
  <img alt="Angular" src="https://img.shields.io/badge/Angular-DD0031?logo=angular&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white">
</p>
<p align="center">
  <em>Companion web console for the <a href="https://github.com/flui-cloud/flui.api">Flui control plane</a>, built around the <a href="https://github.com/flui-cloud/flui-spec"><code>flui.yaml</code></a> open specification.</em>
</p>

The official web interface for **Flui** — the open source platform for running independent cloud on the providers you choose, on the servers you own, or both. The dashboard runs on your environment, talks directly to your Flui control plane, and stays fully self-hosted: no central tenant, no managed SaaS in front of it, no telemetry leaving your network.

Flui is designed to deliver modern cloud ergonomics without the lock-in: an open source control plane and an open application specification, with **European cloud providers** at the heart of supported infrastructure — open to any provider through a pluggable adapter model.

<p align="center"><img src=".github/assets/headline-no-icon.png" alt="Flui" /></p>

## What's inside

A complete operator console for a Flui environment:

- **Applications** — deploy from catalog, framework templates, or your own `flui.yaml`; manage revisions, scaling, env vars, secrets, and lifecycle.
- **Build & CI** — GitHub Actions integration, GHCR PAT management, build progress, logs, crash diagnoses.
- **Clusters & infrastructure** — compute, storage, network, SSH keys, firewalls (desired-state, GitOps-style reconciliation).
- **Platform services** — load balancers, databases, queues, DNS.
- **Observability** — metrics, logs, dashboards across every workload.
- **Identity & access** — single sign-on for the platform and the apps deployed on it.
- **Providers** — manage cloud provider credentials and per-provider settings.

The CLI (`flui`) and the dashboard are both first-class clients of the same Flui API — complementary, not alternatives.

## Quickstart

The dashboard ships with every Flui environment and comes up automatically:

```bash
npm install -g @flui-cloud/cli
flui env create
```

Full guide → [docs.flui.cloud](https://docs.flui.cloud).

## Local development

The dashboard talks to a running Flui environment. The typical flow points it at one provisioned through the CLI:

```bash
# 1. Provision (or pick) a Flui environment
flui env create

# 2. Wire the cluster endpoints and OIDC config into src/assets/config.json
flui env export-config --dashboard-path .

# 3. Install and run the dev server
pnpm install
pnpm start                # http://localhost:4200
```

Working against a locally-running Flui API? Use [`flui dev creds`](https://docs.flui.cloud/cli/dev-tools/) and [`flui dev tunnel`](https://docs.flui.cloud/cli/dev-tools/) to wire credentials and open tunnels to the cluster's data plane.

Other helpers:

```bash
pnpm run api:generate     # regenerate the typed API client from a running backend
pnpm run build            # production build
```

**Stack:** Angular standalone components, Signals for state (no external store), Spartan UI on TailwindCSS, strict TypeScript with an API client generated from the Flui OpenAPI spec.

## Architecture

The dashboard is a pure client of the Flui API. It performs no provider calls of its own, holds no long-lived server-side state, and has no separate auth backend — authentication is delegated to the Flui identity stack (Zitadel) running inside your environment.

> The boundary that matters is between _Flui control plane_ and _user-owned infrastructure_. The dashboard runs on the control plane side, which itself runs on infrastructure you own.

Architecture deep dive → **[docs.flui.cloud](https://docs.flui.cloud)**.

## Status

Flui is in **alpha**. The dashboard ships with every environment and is used daily, but the surface area is large — expect UI iterations and occasional breaking changes alongside API stabilization.

## Links

- [flui.cloud](https://flui.cloud) — website
- [docs.flui.cloud](https://docs.flui.cloud) — documentation
- [github.com/flui-cloud/core](https://github.com/flui-cloud/core) — full Flui codebase
- [hello@flui.cloud](mailto:hello@flui.cloud) — get in touch

## Contributing

Issues and pull requests are welcome. For substantial changes, open an issue first. TypeScript on Angular, `pnpm` as package manager. Setup guide in the [docs](https://docs.flui.cloud).

## License

Released under the [GNU Affero General Public License v3](LICENSE) — fully open source, no open core, no enterprise gating.

---

<p align="center">
  <em>Built and maintained by <a href="https://gojodigital.com/">Dawit</a>.</em>
</p>
