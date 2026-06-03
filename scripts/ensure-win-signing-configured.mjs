const env = process.env

const hasPfxSigning =
  Boolean(env.WIN_CSC_LINK || env.CSC_LINK) &&
  Boolean(env.WIN_CSC_KEY_PASSWORD || env.CSC_KEY_PASSWORD)

const hasAzureTrustedSigning =
  Boolean(env.AZURE_TRUSTED_SIGNING_ENDPOINT) &&
  Boolean(env.AZURE_TRUSTED_SIGNING_ACCOUNT_NAME) &&
  Boolean(env.AZURE_TRUSTED_SIGNING_CERTIFICATE_PROFILE_NAME) &&
  Boolean(env.AZURE_TRUSTED_SIGNING_PUBLISHER_NAME) &&
  Boolean(env.AZURE_TENANT_ID) &&
  Boolean(env.AZURE_CLIENT_ID) &&
  Boolean(env.AZURE_CLIENT_SECRET || env.AZURE_FEDERATED_TOKEN_FILE)

if (hasPfxSigning || hasAzureTrustedSigning) {
  console.log(hasAzureTrustedSigning
    ? 'Windows signing configured: Azure Trusted Signing'
    : 'Windows signing configured: PFX/CSC')
  process.exit(0)
}

console.error(`
Windows release signing is not configured.

Set one of these before running npm run package:win:

1. PFX/CSC certificate
   WIN_CSC_LINK or CSC_LINK
   WIN_CSC_KEY_PASSWORD or CSC_KEY_PASSWORD

2. Azure Trusted Signing
   AZURE_TRUSTED_SIGNING_ENDPOINT
   AZURE_TRUSTED_SIGNING_ACCOUNT_NAME
   AZURE_TRUSTED_SIGNING_CERTIFICATE_PROFILE_NAME
   AZURE_TRUSTED_SIGNING_PUBLISHER_NAME
   AZURE_TENANT_ID
   AZURE_CLIENT_ID
   AZURE_CLIENT_SECRET or AZURE_FEDERATED_TOKEN_FILE

Unsigned local test builds are still available with:
   npm run package:win:unsigned
`)

process.exit(1)
