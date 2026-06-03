const azureSigningConfigured =
  process.env.AZURE_TRUSTED_SIGNING_ENDPOINT &&
  process.env.AZURE_TRUSTED_SIGNING_ACCOUNT_NAME &&
  process.env.AZURE_TRUSTED_SIGNING_CERTIFICATE_PROFILE_NAME &&
  process.env.AZURE_TRUSTED_SIGNING_PUBLISHER_NAME

const signtoolOptions = {
  signingHashAlgorithms: ['sha256'],
  rfc3161TimeStampServer: process.env.WIN_CSC_TIMESTAMP_URL || 'http://timestamp.digicert.com',
}

if (process.env.WIN_CSC_PUBLISHER_NAME || process.env.CSC_PUBLISHER_NAME) {
  signtoolOptions.publisherName = process.env.WIN_CSC_PUBLISHER_NAME || process.env.CSC_PUBLISHER_NAME
}

if (process.env.WIN_CSC_SUBJECT_NAME || process.env.CSC_SUBJECT_NAME) {
  signtoolOptions.certificateSubjectName = process.env.WIN_CSC_SUBJECT_NAME || process.env.CSC_SUBJECT_NAME
}

module.exports = {
  appId: 'com.mypact.myfuture',
  productName: 'My Pact',
  executableName: 'My Pact',
  icon: 'resources/icon.ico',
  directories: {
    output: 'dist',
  },
  files: [
    'out/**/*',
    'package.json',
  ],
  extraResources: [
    {
      from: 'resources',
      to: 'resources',
    },
  ],
  win: {
    target: [
      {
        target: 'nsis',
        arch: ['x64'],
      },
    ],
    icon: 'resources/icon.ico',
    forceCodeSigning: true,
    ...(azureSigningConfigured
      ? {
          azureSignOptions: {
            endpoint: process.env.AZURE_TRUSTED_SIGNING_ENDPOINT,
            codeSigningAccountName: process.env.AZURE_TRUSTED_SIGNING_ACCOUNT_NAME,
            certificateProfileName: process.env.AZURE_TRUSTED_SIGNING_CERTIFICATE_PROFILE_NAME,
            publisherName: process.env.AZURE_TRUSTED_SIGNING_PUBLISHER_NAME,
          },
        }
      : {
          signtoolOptions,
        }),
  },
  nsis: {
    oneClick: true,
    perMachine: true,
    include: 'build/installer.nsh',
    createDesktopShortcut: false,
    createStartMenuShortcut: true,
    shortcutName: 'My Pact',
    deleteAppDataOnUninstall: false,
    uninstallDisplayName: 'My Pact',
  },
  mac: {
    target: [
      {
        target: 'dmg',
        arch: ['arm64', 'x64'],
      },
    ],
    icon: 'resources/icon-256.png',
  },
}
