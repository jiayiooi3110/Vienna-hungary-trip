# Shared sync through a Google Sheet: setup

Everything you change on the trip site is shared between your phones through one tab of a Google Sheet:

- waypoints (✓)
- day moves on the map
- schedule edits: a block's start time, end time, day, and personal note

Until this is set up, changes stay on the phone where you made them.

You can use **a sheet you already have**. The script adds one new tab called `TripMap` and leaves your other tabs alone.

> **What Google will ask permission for:** "See, edit, create and delete *this* spreadsheet". The script is marked `@OnlyCurrentDoc`, so it can't open the rest of your Drive. It can reach every tab in this one spreadsheet, but its code only reads and writes the `TripMap` tab.

---

## 1. Open the script editor in your sheet

1. Open the Google Sheet you want to use, in your personal Google account (not a work or school one; those often block step 4).
2. Go to **Extensions → Apps Script**. A new tab opens with a file called `Code.gs`.

## 2. Paste the script

1. Open `apps-script/TripMapSync.gs` from this folder and copy all of it.
2. In the Apps Script tab, select everything in `Code.gs`, delete it, and paste.
3. Click the **disk icon (Save)**. You can rename the project (top left) to something like *Trip site sync*.

## 3. Set the edit code

This is the password the site asks for once on each phone before it can save changes. Reading the plan doesn't need it.

1. In the Apps Script tab, click **⚙ Project Settings** (left sidebar).
2. Scroll to **Script properties** → **Add script property**.
3. **Property:** `EDIT_CODE` · **Value:** a passphrase of your choice, e.g. `danube-2026`.
4. Click **Save script properties**.

Share the passphrase with your travel partner directly (message or in person). Don't put it in the website files.

## 4. Deploy it as a web app

1. Click **Deploy → New deployment** (top right).
2. Click the **⚙ gear** next to "Select type" → **Web app**.
3. Fill in:
   - **Description:** `Trip site sync`
   - **Execute as:** **Me**
   - **Who has access:** **Anyone**. The site can't sign in to Google, so this is required. Anyone with the URL can *read* the shared changes, but changing anything needs the edit code.
4. Click **Deploy**.
5. **Authorise:** click **Authorize access**, then pick your account.
   - Google shows **"Google hasn't verified this app"**. That's expected for your own script.
   - Click **Advanced → Go to Trip site sync (unsafe) → Allow**.
6. Copy the **Web app URL**. It ends in `/exec`, like `https://script.google.com/macros/s/AKfy…/exec`.

## 5. Connect the site

Send me the `/exec` URL and I'll add it. Or do it yourself:

1. In `index.html`, find this line near the top of the map scripts:
   ```js
   var SYNC_URL='';   // e.g. 'https://script.google.com/macros/s/…/exec'
   ```
2. Paste the URL between the quotes, save, and publish the site as usual.

## 6. First use on each phone

1. Open the site. Your existing changes from that phone are sent to the sheet the first time it syncs.
2. The first time you save a change, the site asks for the **edit code**. Enter it once and the phone remembers it.
3. The map's changes bar shows the status, for example *"Shared via your Google Sheet · synced 10:42"*. **Sync now** forces an update.

The site checks the sheet every minute, whenever you come back to the tab, and when the phone comes back online. Changes made offline wait and are sent automatically.

---

## Editing the sheet directly

The `TripMap` tab is readable and you can edit it. The site picks up changes within a minute.

| kind | id | value | meaning |
|---|---|---|---|
| `wp` | `5\|cafe_mozart` | `1` | Café Mozart is a waypoint on Day 5 |
| `move` | `poeschl@5` | `9` | Gasthaus Pöschl moved from Day 5 to Day 9 on the map |
| `block` | `d7-ervin-szabo-library` | `{"start":"15:00","end":"16:00","day":7,"note":"…"}` | That schedule block's new time, day or note |

- **Undo one change:** delete its row.
- **Find a block's id:** it's in `index.html` as `data-id="…"` on each card.

## If you update the script later

Use **Deploy → Manage deployments → ✏ Edit → Version: New version → Deploy**. That keeps the same URL. A *New deployment* creates a new URL that the site would need.

## Troubleshooting

| Problem | Fix |
|---|---|
| The status line says *"Wrong edit code"* | The code is asked for again on the next save. Check it matches `EDIT_CODE` exactly. |
| It says *"Could not reach the shared sheet"* | Check the URL ends in `/exec`, and that **Who has access** is **Anyone**. |
| Nothing syncs after editing the script | You need to deploy a **new version** (see above). |
| You want to start over | Use **Reset** in the map's changes bar. It clears all shared changes for everyone. Or delete every row below the header in `TripMap`. |
