![OpenMRS CI](https://github.com/openmrs/openmrs-esm-admin-tools/actions/workflows/ci.yml/badge.svg)

# Reports Module

`openmrs-esm-reports-app` is a modular reporting solution for O3, providing tools to manage report executions and schedules.

## Features

- `Report Execution Overview`: Monitor execution history including queued reports, with options to execute specific reports, preserve, download, or delete completed executions

- `Schedule Management`: View execution schedules with capabilities to view, edit, or delete existing schedules
The Reports app is available in the app switcher menu under the `Reports` entry.

## Setup

See the guidance in the [Developer Documentation](https://o3-docs.openmrs.org/docs/frontend-modules/development#installing-dependencies).

This repository uses Yarn. Run the following commands from the repository root.

This deployment targets OpenMRS Core 10.0.0. Keep the `openmrs` build tooling and
`@openmrs/esm-framework` development dependencies pinned to 10.0.0, and the Reports
app's framework peer dependency on `10.x`. Using `next` builds the app against a
newer module-loading runtime that the deployed shell does not provide.

Install dependencies:

```bash
yarn install
```

Run the Reports app against the Luqman backend and deployment configuration:

```bash
yarn start --sources 'packages/esm-reports-app' \
  --backend http://192.168.18.19 \
  --config-file ../openmrs-distro-referenceapplication/frontend/config-core-openmrs.json \
  --importmap https://demo.alphabase.co/emr/importmap.json \
  --routes https://demo.alphabase.co/emr/routes.registry.json \
  --open false \
  --port 8040
```

Build and package the Reports app for the local distribution:

```bash
yarn workspace @openmrs/esm-reports-app build && \
yarn workspace @openmrs/esm-reports-app pack \
  --out ../openmrs-distro-referenceapplication/frontend/luqman-apps/local-esm-reports-app.tgz
```
