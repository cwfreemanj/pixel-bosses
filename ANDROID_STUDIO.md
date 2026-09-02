# Build Pixel Bosses as an Android APK

## One-time setup

1. Install Node.js 20 or newer.
2. Install Android Studio and accept its Android SDK setup.
3. In Android Studio's **SDK Manager**, install a current Android SDK Platform, Build Tools, and Platform Tools.
4. Use Android Studio's bundled JDK/JBR 21 when prompted. Capacitor 7 supports modern Android builds; do not manually downgrade Gradle files.

## Generate the Android project

Open a terminal in the folder containing `package.json`:

```bash
npm install
npm test
npm run android:add
npm run android:open
```

`android:add` builds the web bundle into `www/` and creates the native `android/` folder. Only run it once. After future web edits, run:

```bash
npm run android:sync
npm run android:open
```

## Configure online play

Deploy the server using `DEPLOYMENT.md`. Launch the app, open **Settings**, paste the full HTTPS Railway URL, and tap **Save Settings**. Example:

```text
https://pixel-bosses-production.up.railway.app
```

Do not add `/multiplayer`; the app adds that WebSocket path automatically.

Before release, also add your exact Railway host to `server.allowNavigation` in `capacitor.config.json` if your Capacitor/Android security policy requires it, then run `npm run android:sync` again.

## Test a debug build

1. Let Android Studio finish Gradle sync.
2. Connect a phone with USB debugging enabled or create an emulator.
3. Select the `app` run configuration.
4. Press **Run**.

To create an installable debug APK, choose **Build → Build Bundle(s) / APK(s) → Build APK(s)**. Android Studio reports the location, normally:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

If Android 15 reports “There was a problem parsing the package,” rebuild instead of renaming the ZIP or APK, make sure the transfer completed, and install the actual `app-debug.apk`. A Railway or GitHub connection is not required for Android to parse an APK; those services only affect online features.

## Create a signed release

1. Choose **Build → Generate Signed Bundle / APK**.
2. Prefer **Android App Bundle (AAB)** for Google Play, or APK for direct testing.
3. Create and safely back up a release keystore. Losing it can prevent future updates.
4. Select the `release` build variant, complete the wizard, and test the signed artifact on a real phone.
5. For Google Play, upload the AAB and complete signing, privacy/data-safety, screenshots, content rating, and testing-track requirements.

## Common fixes

- **Web changes missing:** run `npm run android:sync` before building.
- **Cleartext/network error:** use an `https://` Railway URL, not `http://`.
- **Connection failed:** open the Railway `/health` URL in a browser, then check the exact URL saved in game.
- **Gradle/JDK mismatch:** set Gradle JDK to Android Studio's embedded JBR 21.
- **Old app data:** uninstall the debug app or clear its storage when testing migrations.
- **No `adb` command:** use Android Studio's bundled terminal/platform-tools or add the SDK `platform-tools` folder to Windows `PATH`; Android Studio can still install builds without a global `adb` command.
