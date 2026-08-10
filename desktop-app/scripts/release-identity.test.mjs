import assert from "node:assert/strict";
import test from "node:test";

import {
  OPENAI_APPLE_TEAM_ID,
  assertMacReleaseIdentityConfiguration,
  assertOpenAiMacSignature,
  macIdentityBelongsToOpenAI,
  powershellLiteral,
  windowsAuthenticodeVerificationScript,
  windowsCertificateSha256,
  windowsPublisherSubject,
} from "./release-identity.mjs";

const openAiIdentity = `Developer ID Application: OpenAI OpCo, LLC (${OPENAI_APPLE_TEAM_ID})`;

test("pins macOS signing and notarization to the OpenAI Apple team", () => {
  assert.equal(macIdentityBelongsToOpenAI(openAiIdentity), true);
  assert.equal(
    macIdentityBelongsToOpenAI(
      "Developer ID Application: Example Corp (AAAAAAAAAA)",
    ),
    false,
  );
  assert.equal(
    assertMacReleaseIdentityConfiguration({
      CSC_NAME: openAiIdentity,
      APPLE_TEAM_ID: OPENAI_APPLE_TEAM_ID,
    }),
    OPENAI_APPLE_TEAM_ID,
  );
  assert.throws(
    () =>
      assertMacReleaseIdentityConfiguration({
        CSC_NAME: "Developer ID Application: Example Corp (AAAAAAAAAA)",
      }),
    /OpenAI Developer ID Application identity/u,
  );
  assert.throws(
    () =>
      assertMacReleaseIdentityConfiguration({ APPLE_TEAM_ID: "AAAAAAAAAA" }),
    /APPLE_TEAM_ID must match/u,
  );
});

test("rejects a valid Developer ID signature from any other Apple team", () => {
  assert.doesNotThrow(() =>
    assertOpenAiMacSignature(
      `${openAiIdentity}\nTeamIdentifier=${OPENAI_APPLE_TEAM_ID}\n`,
    ),
  );
  assert.throws(
    () =>
      assertOpenAiMacSignature(
        "Authority=Developer ID Application: Example Corp (AAAAAAAAAA)\nTeamIdentifier=AAAAAAAAAA\n",
      ),
    /pinned OpenAI Apple team/u,
  );
});

test("requires an exact canonical OpenAI publisher subject for Windows", () => {
  const subject = "CN=OpenAI OpCo, LLC, O=OpenAI OpCo, LLC, C=US";
  assert.equal(
    windowsPublisherSubject({
      CODEX_DESKTOP_WINDOWS_PUBLISHER_SUBJECT: subject,
    }),
    subject,
  );
  assert.throws(() => windowsPublisherSubject({}), /requires/u);
  assert.throws(
    () =>
      windowsPublisherSubject({
        CODEX_DESKTOP_WINDOWS_PUBLISHER_SUBJECT: "CN=Example Corp, C=US",
      }),
    /canonical OpenAI X\.509 subject/u,
  );
  assert.throws(
    () =>
      windowsPublisherSubject({
        CODEX_DESKTOP_WINDOWS_PUBLISHER_SUBJECT: "CN=OpenAI\nCN=Example",
      }),
    /canonical OpenAI X\.509 subject/u,
  );
});

test("normalizes an optional Windows signing-certificate SHA-256 pin", () => {
  const colonSeparated = Array.from({ length: 32 }, () => "ab").join(":");
  assert.equal(
    windowsCertificateSha256({
      CODEX_DESKTOP_WINDOWS_CERTIFICATE_SHA256: colonSeparated,
    }),
    "AB".repeat(32),
  );
  assert.equal(windowsCertificateSha256({}), undefined);
  assert.throws(
    () =>
      windowsCertificateSha256({
        CODEX_DESKTOP_WINDOWS_CERTIFICATE_SHA256: "not-a-fingerprint",
      }),
    /64-character SHA-256/u,
  );
});

test("builds an injection-safe exact-publisher Authenticode check", () => {
  const publisher = "CN=OpenAI OpCo, LLC, O=OpenAI's Company, C=US";
  const fingerprint = "AB".repeat(32);
  const script = windowsAuthenticodeVerificationScript(
    "C:\\Release\\Codex Desktop.exe",
    publisher,
    fingerprint,
  );

  assert.match(script, /Get-AuthenticodeSignature/u);
  assert.match(script, /System\.StringComparison\]::Ordinal/u);
  assert.match(script, /OpenAI''s Company/u);
  assert.match(script, new RegExp(fingerprint, "u"));
  assert.equal(powershellLiteral("a'b"), "'a''b'");
});
