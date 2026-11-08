# ServeNow Android test build

This wraps the live demo (https://benobengapori.github.io/servenow-portal/) in an Android app
(a Trusted Web Activity). It's for internal testing only, not the public Play Store.

## Before you start

- **Package name:** `ca.servenow.portal` is a placeholder. Use a name on a domain you control
  (for example `ca.kanatir.servenow`). Change `packageId` in `twa-manifest.json` before building.
- **Signing key:** create it once and keep it safe. Losing it means you can never update the app.

```bash
keytool -genkeypair -v -keystore android.keystore -alias servenow \
  -keyalg RSA -keysize 2048 -validity 10000
```

Do not commit `android.keystore` to git. Add it to `.gitignore`.

## Option A: online, no installs (easiest)

1. Open https://www.pwabuilder.com and enter `https://benobengapori.github.io/servenow-portal/home/`.
2. Choose **Android** → **Generate package**. Fill in the package ID and the signing details
   (or let it create a key and download it; save that key safely).
3. Download the `.aab` (for Play) or `.apk` (for direct install).

## Option B: Bubblewrap on your computer

Requires Node 18+, Java 17, and the Android SDK (Bubblewrap can install it for you).

```bash
npm i -g @bubblewrap/cli
cd android
bubblewrap init --manifest https://benobengapori.github.io/servenow-portal/manifest.webmanifest
# or edit twa-manifest.json, then:
bubblewrap build          # produces app-release-bundle.aab and app-release-signed.apk
```

## Testing with Henry (Google Play internal testing)

1. Create a Google Play Console account (US$25, one-time).
2. Create an app, then upload the `.aab` to **Testing → Internal testing**.
3. Add Henry's Google account to the tester list and send him the opt-in link.
4. He installs it from the Play Store link. No public review is needed.

## Important: the full-screen fix

Android only hides the browser bar if the site proves ownership with a file called
`assetlinks.json` at the **root** of its domain:
`https://benobengapori.github.io/.well-known/assetlinks.json`.

GitHub Pages serves this project under a sub-path, so that file must live in the
`benobengapori.github.io` repository (the user site), not in this one. Until it's there, the app
still works but shows a thin browser bar at the top.

Once the package name and signing key are final, the `assetlinks.json` content comes from:

```bash
bubblewrap fingerprint
```

or from the PWABuilder package page. A custom domain (for example `app.servenow.ca`) avoids the
sub-path problem entirely and is the better long-term choice.

## Checklist

- [ ] Package name chosen and set in `twa-manifest.json`
- [ ] Signing key created and stored safely (not in git)
- [ ] `.aab` built and downloaded
- [ ] Play Console account and internal test track set up
- [ ] `assetlinks.json` added to the user site (or custom domain chosen)
- [ ] Henry added as a tester and installed the app
