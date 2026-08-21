# Monorepo changed-path plan

This plan records the Render build-filter intent for DEC-026 without changing a live service in P0-003A.

| Future service | Rebuild when these paths change |
|---|---|
| Customer | `apps/customer/**`, `packages/**`, root workspace/lock/config files |
| Marketing | `apps/marketing/**`, `packages/ui/**`, `packages/config/**`, root workspace/lock/config files |
| Admin | `apps/admin/**`, `packages/**`, root workspace/lock/config files |

## Gate before activation

Capture the real Render service ID, current Root Directory, environment name, build/start commands and environment-variable set. Add the filters one service at a time only after its application move is green. P0-003A does not activate these filters or change a Root Directory.
