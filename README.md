# Redapto

Redapto is a local coding agent for exploring repositories, editing code, running commands, and coordinating development workflows from the terminal.

## Build from source

Requirements:

- macOS 12+, Linux, or Windows 11 through WSL2
- Rust and Cargo
- `just`, DotSlash, and `cargo-nextest`

Build the development binary:

```bash
cd codex-rs
cargo build --bin redapto
```

Run the interactive terminal interface:

```bash
export REDAPTO_API_KEY="your-provider-key"
./target/debug/redapto
```

Run a non-interactive task:

```bash
./target/debug/redapto exec "explain this codebase"
```

Redapto stores user configuration and local state in `~/.redapto` by default. Set
`REDAPTO_HOME` to use another existing directory. The legacy home variable is
accepted as a compatibility fallback for existing installations.

Built-in terminal pets are optional. To host them under Redapto, set
`REDAPTO_PET_ASSET_BASE_URL` to the HTTPS directory containing the versioned
spritesheets; custom pets remain local under `REDAPTO_HOME`.

The downstream product name is Redapto. Some internal crate, protocol, and
wire-format identifiers retain their upstream names temporarily for compatibility
while the fork is separated from its original provider infrastructure.

## Development

```bash
cd codex-rs
just fmt
just fix -p <crate-you-touched>
just test -p <crate-you-touched>
```

This repository is licensed under the [Apache-2.0 License](LICENSE).
