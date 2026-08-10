export const OPENAI_APPLE_TEAM_ID = "2DC432GLL2";

const WINDOWS_PUBLISHER_SUBJECT_ENV = "CODEX_DESKTOP_WINDOWS_PUBLISHER_SUBJECT";
const WINDOWS_CERTIFICATE_SHA256_ENV =
  "CODEX_DESKTOP_WINDOWS_CERTIFICATE_SHA256";

function value(env, name) {
  return env[name]?.trim();
}

function hasControlCharacters(input) {
  return /[\u0000-\u001f\u007f]/u.test(input);
}

export function macIdentityBelongsToOpenAI(identity) {
  const escapedTeamId = OPENAI_APPLE_TEAM_ID.replaceAll(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
  return new RegExp(
    `Developer ID Application:[^\\r\\n]*\\(${escapedTeamId}\\)(?:\\s|$)`,
  ).test(identity);
}

export function assertMacReleaseIdentityConfiguration(env = process.env) {
  const configuredTeamId = value(env, "CODEX_DESKTOP_MAC_TEAM_ID");
  if (configuredTeamId && configuredTeamId !== OPENAI_APPLE_TEAM_ID) {
    throw new Error(
      `CODEX_DESKTOP_MAC_TEAM_ID must be the pinned OpenAI Apple team ${OPENAI_APPLE_TEAM_ID}`,
    );
  }

  const notarizationTeamId = value(env, "APPLE_TEAM_ID");
  if (notarizationTeamId && notarizationTeamId !== OPENAI_APPLE_TEAM_ID) {
    throw new Error(
      `APPLE_TEAM_ID must match the pinned OpenAI Apple team ${OPENAI_APPLE_TEAM_ID}`,
    );
  }

  const signingIdentity = value(env, "CSC_NAME");
  if (signingIdentity && !macIdentityBelongsToOpenAI(signingIdentity)) {
    throw new Error(
      `CSC_NAME must select an OpenAI Developer ID Application identity for team ${OPENAI_APPLE_TEAM_ID}`,
    );
  }

  return OPENAI_APPLE_TEAM_ID;
}

export function assertOpenAiMacSignature(signatureOutput) {
  const teamMatch = /^TeamIdentifier=(.+)$/mu.exec(signatureOutput);
  if (teamMatch?.[1].trim() !== OPENAI_APPLE_TEAM_ID) {
    throw new Error(
      `macOS app signature team must be the pinned OpenAI Apple team ${OPENAI_APPLE_TEAM_ID}`,
    );
  }
  if (!macIdentityBelongsToOpenAI(signatureOutput)) {
    throw new Error(
      `macOS app must be signed with an OpenAI Developer ID Application identity for team ${OPENAI_APPLE_TEAM_ID}`,
    );
  }
}

export function windowsPublisherSubject(env = process.env) {
  const publisher = value(env, WINDOWS_PUBLISHER_SUBJECT_ENV);
  if (!publisher) {
    throw new Error(
      `Windows release packaging requires ${WINDOWS_PUBLISHER_SUBJECT_ENV} with the exact OpenAI signing-certificate subject`,
    );
  }
  if (
    publisher.length > 2_048 ||
    hasControlCharacters(publisher) ||
    !/(?:^|,\s*)CN=/iu.test(publisher) ||
    !/OpenAI/iu.test(publisher)
  ) {
    throw new Error(
      `${WINDOWS_PUBLISHER_SUBJECT_ENV} must be a single canonical OpenAI X.509 subject containing CN=`,
    );
  }
  return publisher;
}

export function windowsCertificateSha256(env = process.env) {
  const fingerprint = value(env, WINDOWS_CERTIFICATE_SHA256_ENV);
  if (!fingerprint) return undefined;
  const normalized = fingerprint.replaceAll(":", "").toUpperCase();
  if (!/^[0-9A-F]{64}$/u.test(normalized)) {
    throw new Error(
      `${WINDOWS_CERTIFICATE_SHA256_ENV} must be a 64-character SHA-256 certificate fingerprint`,
    );
  }
  return normalized;
}

export function powershellLiteral(input) {
  return `'${input.replaceAll("'", "''")}'`;
}

export function windowsAuthenticodeVerificationScript(
  path,
  publisher,
  certificateSha256,
) {
  const commands = [
    `$signature = Get-AuthenticodeSignature -LiteralPath ${powershellLiteral(path)}`,
    `if ($signature.Status -ne 'Valid') { Write-Error \"Invalid Authenticode signature: $($signature.Status)\"; exit 1 }`,
    `if ($null -eq $signature.SignerCertificate) { Write-Error \"Authenticode signer certificate is missing\"; exit 1 }`,
    `$actualPublisher = $signature.SignerCertificate.Subject`,
    `if (-not [string]::Equals($actualPublisher, ${powershellLiteral(publisher)}, [System.StringComparison]::Ordinal)) { Write-Error \"Unexpected Authenticode publisher: $actualPublisher\"; exit 1 }`,
  ];

  if (certificateSha256) {
    commands.push(
      `$sha256 = [System.Security.Cryptography.SHA256]::Create()`,
      `try { $actualCertificateSha256 = ([System.BitConverter]::ToString($sha256.ComputeHash($signature.SignerCertificate.RawData))).Replace('-', '') } finally { $sha256.Dispose() }`,
      `if (-not [string]::Equals($actualCertificateSha256, ${powershellLiteral(certificateSha256)}, [System.StringComparison]::OrdinalIgnoreCase)) { Write-Error \"Unexpected Authenticode certificate SHA-256: $actualCertificateSha256\"; exit 1 }`,
    );
  }

  return commands.join("; ");
}
