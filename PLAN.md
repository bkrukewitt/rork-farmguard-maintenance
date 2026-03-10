# Fix image sharing across devices via cloud upload

## Problem
When a user takes or picks a photo on one device, it's saved as a local file path. Other devices that sync the data receive that path but can't access the file — so images appear broken or missing.

## Solution
Upload all images to cloud storage (Supabase Storage) and save the shareable URL instead of the local file path. This way, any device that syncs the data can download and display the image.

## What will change

**Image Upload**
- When a photo is taken or selected, it will be uploaded to cloud storage automatically
- A loading indicator will show while the upload is in progress
- Once uploaded, the shareable URL is saved with the equipment/inventory/work order data
- If upload fails, the user will see a clear error message with option to retry

**Affected areas**
- Equipment photos (add & edit screens)
- Inventory part photos (add screen)
- Work order images (detail screen)

**User experience**
- Taking/picking a photo will feel the same — just a brief upload step after selection
- Photos will now appear correctly on all synced devices
- Existing local-only images won't break — they'll still show on the original device, and can be re-uploaded by editing the item
