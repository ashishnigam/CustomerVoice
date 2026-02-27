# Terraform Scaffold

This folder contains provider-neutral Terraform scaffolding for CustomerVoice.

## Next steps
1. Add provider-specific modules under `infra/terraform/providers/{aws,gcp,azure}`.
2. Define shared module contracts for networking, compute, database, and secrets.
3. Keep residency-zone parameters explicit (`US` default; `EU/IN` opt-in).
