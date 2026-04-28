---
title: BYOK Feature in Copilot CLI
author: GitHub Team
basePath: ..
options:
  zenMode: false
---
<!-- id: intro -->

# Bring Your Own Key (BYOK)

- New feature in Copilot CLI
- Supports BYOK and local models
- Released on April 7, 2026

[Learn more](https://github.blog/changelog/2026-04-07-copilot-cli-now-supports-byok-and-local-models/)

---

<!-- id: what-is-byok -->

# What is BYOK?

- BYOK: Bring Your Own Key
- Allows users to manage their encryption keys
- Enhances security and compliance

---

<!-- id: benefits -->

# Why Use BYOK?

- Full control over encryption keys
- Meets regulatory requirements
- Protects sensitive data

---

<!-- id: setup-overview -->

# Setting Up BYOK

1. Generate an encryption key
2. Configure Copilot CLI to use the key
3. Verify the setup

[View setup guide](action:file.open?path=docs/byok-setup.md)

---

<!-- id: generate-key -->

# Step 1: Generate an Encryption Key

Use your preferred key management tool:

```action
type: terminal.run
label: Generate Key
command:
  win32: "keytool -genkeypair -alias mykey -keyalg RSA -keystore mykeystore.jks"
  darwin: "openssl genrsa -out mykey.pem 2048"
  linux: "openssl genrsa -out mykey.pem 2048"
```

---

<!-- id: configure-cli -->

# Step 2: Configure Copilot CLI

Update the configuration file:

[](render:file?path=config/copilot.json&lines=10-20)

[Open configuration file](action:file.open?path=config/copilot.json)

---

<!-- id: verify-setup -->

# Step 3: Verify the Setup

Run the following command:

```action
type: terminal.run
label: Verify BYOK Setup
command: copilot verify --byok
```

---

<!-- id: local-models -->

# Local Models Support

- Use models hosted on your infrastructure
- Combine with BYOK for full control

[Learn more](action:file.open?path=docs/local-models.md)

---

<!-- id: summary -->

# Summary

- BYOK enhances security and compliance
- Full control over encryption keys
- Supports local models for added flexibility

[Get started with BYOK](action:terminal.run?command=copilot%20init%20--byok)