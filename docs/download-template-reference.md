# Download Template – Reference for Copying to Another App

This document captures the **working** "download template" pattern from FarmGuard (this repo) so you can reuse it in another app. Use it by opening this file in Cursor and asking the AI: *"Implement download template the same way as in this reference"* (or paste the relevant sections into your other app’s chat).

---

## 1. What it does

- **Web:** Creates a blob, triggers a download via a temporary `<a download>` link, then revokes the URL.
- **iOS / Android:** Writes the template string to a file in the app cache, then opens the native share sheet so the user can save or share the file. If sharing isn’t available, falls back to `Share.share` with the raw text.

---

## 2. Dependencies (package.json)

```json
"expo-file-system": "~19.0.21",
"expo-sharing": "~14.0.0"
```

`Share` is from `react-native` (no extra install).  
Ensure the other app has `expo-file-system` and `expo-sharing` installed.

---

## 3. Imports (use these in the file that runs the download)

```ts
import { Share, Alert, Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
```

---

## 4. Reusable helper (copy this into your other app)

You can put this in a util (e.g. `utils/downloadTemplate.ts`) and call it from any screen.

```ts
import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Share } from 'react-native';

export type DownloadTemplateOptions = {
  /** Full content of the file (e.g. CSV string) */
  content: string;
  /** Filename for the download (e.g. 'my_template.csv') */
  fileName: string;
  /** MIME type (e.g. 'text/csv', 'text/plain') */
  mimeType: string;
  /** UTI for iOS share sheet (e.g. 'public.comma-separated-values-text') – optional */
  uti?: string;
  /** Title for the share dialog – optional */
  dialogTitle?: string;
  /** Fallback title if Share.share is used – optional */
  shareTitle?: string;
};

export async function downloadTemplate(options: DownloadTemplateOptions): Promise<void> {
  const {
    content,
    fileName,
    mimeType,
    uti = 'public.plain-text',
    dialogTitle = 'Save Template',
    shareTitle = 'Template',
  } = options;

  if (Platform.OS === 'web') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return;
  }

  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true });
  file.write(content);

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(file.uri, {
      mimeType,
      dialogTitle,
      UTI: uti,
    });
  } else {
    await Share.share({
      message: content,
      title: shareTitle,
    });
  }
}
```

---

## 5. Example usage in a screen (handler that calls the helper)

Replace `getMyTemplateContent()` with whatever generates your template string (e.g. a CSV header + example row).

```ts
const handleDownloadTemplate = async () => {
  try {
    const templateContent = getMyTemplateContent(); // your function that returns the template string

    await downloadTemplate({
      content: templateContent,
      fileName: 'my_template.csv',
      mimeType: 'text/csv',
      uti: 'public.comma-separated-values-text',
      dialogTitle: 'Save My Template',
      shareTitle: 'My Import Template',
    });

    Alert.alert('Success', 'Template downloaded successfully!');
  } catch (error) {
    console.error('Download template error:', error);
    Alert.alert('Error', 'Failed to download template. Please try again.');
  }
};
```

---

## 6. Inline version (no helper – copy/paste into one screen)

If you prefer not to add a util file, use this block and replace the three placeholders.

```ts
const handleDownloadTemplate = async () => {
  const templateContent = getMyTemplateContent(); // 1) Your template string

  if (Platform.OS === 'web') {
    const blob = new Blob([templateContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'my_template.csv';           // 2) Filename
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    Alert.alert('Success', 'Template downloaded successfully!');
  } else {
    try {
      const file = new File(Paths.cache, 'my_template.csv');  // 2) Filename
      file.create({ overwrite: true });
      file.write(templateContent);

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'text/csv',
          dialogTitle: 'Save Template',           // 3) Dialog title
          UTI: 'public.comma-separated-values-text',
        });
      } else {
        await Share.share({
          message: templateContent,
          title: 'My Template',
        });
      }
    } catch (error) {
      console.error('Error sharing template:', error);
      Alert.alert('Error', 'Failed to download template. Please try again.');
    }
  }
};
```

Required imports for the inline version:

```ts
import { Share, Alert, Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
```

---

## 7. Notes for the other app

- **expo-file-system:** This uses the `File` and `Paths` API from `expo-file-system` (v19). If the other app uses the legacy string-based API (`documentDirectory`, `cacheDirectory`), the AI can adapt: write with `FileSystem.writeAsStringAsync(cachePath, content)` and pass that path to `Sharing.shareAsync`.
- **File.create:** `file.create({ overwrite: true })` ensures the file exists and is overwritten each time.
- **Sharing.isAvailableAsync:** Always check before calling `shareAsync`; on some simulators or environments sharing isn’t available, so the `Share.share` fallback is important.
- **Web:** There is no share sheet on web, so the pattern uses a programmatic download link. No `expo-sharing` on web.

---

## 8. How to use this in Cursor (other app)

1. **Option A – Same machine:** In the other app’s Cursor workspace, use **@** and reference this file (e.g. from this repo’s path), then say:  
   *"Implement 'Download Template' the same way as in the referenced download-template-reference.md: same dependencies, helper (or inline), and a button that calls it. Our template content is [describe or show your template string]."*

2. **Option B – Copy content:** Open this file, copy the sections you need (e.g. §2 Dependencies, §3 Imports, §4 Helper, §5 Example), paste into the other app’s chat, and ask:  
   *"Add a Download Template button that uses this pattern. Our template is [your content or function]."*

3. **Option C – Repo path:** If the other app is in a different repo, you can still reference this repo’s file by path in Cursor (e.g. `@path/to/rork-farmguard-maintenance/docs/download-template-reference.md`) and ask the AI to replicate the behavior in the current project.
