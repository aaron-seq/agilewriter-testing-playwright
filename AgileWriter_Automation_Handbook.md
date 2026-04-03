# Agile Writer Playwright Handbook

## 1. What this handbook is for

This handbook explains, in simple English:

- how the Agile Writer Playwright project is built
- how the important helper functions work
- how the updated test scripts work
- how we converted Excel test steps into automation
- how to add new scripts in the same style
- what to improve next

This is written as a beginner-friendly reference, not just as a technical note.

---

## 2. Project goal in one sentence

The goal of this project is to automate the Agile Writer UI so that important user flows can be tested again and again with less manual effort.

---

## 3. Main folder structure

Important files and folders:

- `playwright.config.js`
  This controls how Playwright runs.
- `playwright/.auth/user.json`
  This stores the saved login session.
- `tests/AW_00_auth.setup.ts`
  This logs in through Microsoft SSO and saves the session.
- `tests/helpers/app-navigation.ts`
  This opens the dashboard and AgileMapping safely.
- `tests/helpers/training-setup.ts`
  This creates a trained session and gives shared helper functions for mapping tests.
- `tests/*.spec.ts`
  These are the real test scripts.
- `playwright-report/`
  This stores the HTML report.
- `test-results/`
  This stores traces, screenshots, zips, and failure artifacts.

---

## 4. Basic Playwright words you should know

### `test`
A Playwright test case.

Example:

```ts
test('AW_19: Create Final Doc opens review screen', async ({ page }) => {
  // steps
});
```

This means: "Run one automation scenario with this name."

### `expect`
An assertion.

It checks whether something is true.

Example:

```ts
await expect(page.getByRole('button', { name: /Save/i })).toBeVisible();
```

This means: "Make sure the Save button is visible."

### `page`
The current browser tab.

We use it to click, type, navigate, and verify UI elements.

### `locator`
A way to point to an element on the page.

Example:

```ts
page.getByRole('button', { name: /Start Training/i })
```

This means: "Find the button named Start Training."

### `beforeAll`
Steps that run one time before the tests in a file.

We use this when training is expensive and should not be repeated for every test.

### `beforeEach`
Steps that run before every test.

We use this to reopen the trained session before each case.

### `afterAll`
Cleanup that runs once after the tests finish.

### `storageState`
A saved browser login state.

This lets us reuse login instead of signing in every time.

### `retries`
How many times Playwright should rerun a failed test.

This helps with flaky UI behavior.

### `timeout`
How long Playwright should wait before failing.

Longer timeouts are useful when the app is slow.

### `serial`
Run tests one after another instead of in parallel.

This is important when multiple tests share one trained session.

### `false positive`
A test that says "pass" even though the feature was not truly tested.

Example: opening a modal and calling it a pass without checking the real save result.

### `flaky test`
A test that passes sometimes and fails sometimes even when the code did not change.

This usually happens because of timing, unstable UI, login/session problems, or network issues.

---

## 5. How the full framework works from start to finish

This is the full flow:

1. `AW_00_auth.setup.ts` logs in once through Microsoft SSO.
2. Playwright saves the login session into `playwright/.auth/user.json`.
3. Normal test files use that saved session instead of logging in again.
4. The helper `openDashboard()` opens the app safely.
5. The helper `openAgileMapping()` opens the Train Document page.
6. The helper `createTrainingSession()` fills the train form, selects files, starts training, and waits for the training workspace.
7. Each mapping test restores the already-trained URL instead of repeating all the setup.
8. Each test performs only the workflow needed for that Excel case.

This design was chosen because:

- Microsoft login is slow
- training is expensive
- the app can be unstable
- repeated setup creates more failures

---

## 6. `playwright.config.js` explained

File: [playwright.config.js](C:\Users\Aaron Sequeira\Agile Writer Test\playwright.config.js)

```js
const { defineConfig } = require('@playwright/test');
require('dotenv').config();
```

- `defineConfig` is the standard Playwright config wrapper.
- `dotenv` loads values from `.env`, such as `BASE_URL`.

```js
reporter: 'html',
```

- This creates the Playwright HTML report in `playwright-report/`.

```js
timeout: 600_000,
```

- This gives each test up to 10 minutes by default.
- We increased this because the app is slow and training flows can take time.

```js
expect: {
  timeout: 30_000,
},
```

- Each assertion can wait up to 30 seconds.
- This is useful when buttons and panels take time to appear.

```js
workers: 1,
```

- Only one test worker runs at a time.
- This avoids session collisions and reduces environment noise.

```js
use: {
  baseURL: process.env.BASE_URL,
  headless: false,
  actionTimeout: 30_000,
  navigationTimeout: 120_000,
},
```

- `baseURL`: the Agile Writer base URL
- `headless: false`: opens a visible browser so we can observe what is happening
- `actionTimeout`: limit for clicks, fills, checks, etc.
- `navigationTimeout`: limit for page navigation

```js
projects: [
  {
    name: 'setup',
    testMatch: /AW_00_auth\.setup\.ts/,
  },
  {
    name: 'smarter-tests',
    dependencies: ['setup'],
    use: {
      storageState: 'playwright/.auth/user.json',
    },
  },
],
```

- Project `setup` runs the login file.
- Project `smarter-tests` runs normal tests only after login setup finishes.
- `storageState` means all normal tests reuse the saved login session.

This is one of the biggest reasons the suite became more stable.

---

## 7. `AW_00_auth.setup.ts` explained

File: [tests/AW_00_auth.setup.ts](C:\Users\Aaron Sequeira\Agile Writer Test\tests\AW_00_auth.setup.ts)

What it does:

1. Opens the sign-in page
2. Clicks Microsoft SSO
3. Waits for the popup
4. Fills email
5. Fills password
6. Handles "Stay signed in?"
7. Waits for login to complete
8. Saves the session

Important lines:

```ts
const authFile = path.join(__dirname, '../playwright/.auth/user.json');
```

- This decides where the saved session will be stored.

```ts
const popupPromise = page.waitForEvent('popup');
```

- Microsoft login opens a popup window.
- This line tells Playwright to wait for it.

```ts
await page.context().storageState({ path: authFile });
```

- This saves the logged-in session for later reuse.

Why this matters:

- Without this file, each test would need to log in again.
- That would make the suite slower and much more flaky.

---

## 8. `app-navigation.ts` explained

File: [tests/helpers/app-navigation.ts](C:\Users\Aaron Sequeira\Agile Writer Test\tests\helpers\app-navigation.ts)

This file handles safe navigation into the app.

### `BASE_URL`

```ts
export const BASE_URL = process.env.BASE_URL || 'https://app-v2-rc1-aw.smarter.codes';
```

- Uses `.env` if available.
- Falls back to a default URL if `.env` is missing.

### `AUTH_FILE`

```ts
export const AUTH_FILE = path.join(process.cwd(), 'playwright', '.auth', 'user.json');
```

- This points to the saved login session.

### `isVisible(locator, timeout)`

Purpose:

- Try to see if an element is visible.
- Return `false` instead of crashing if it is not found.

Why this is useful:

- Good for optional UI states
- Good for recovery logic

### `assertAppIsReachable(page, step)`

Purpose:

- Detect the browser error page like `This site can't be reached`.

Why this matters:

- Sometimes the problem is not the test.
- Sometimes the app is down or the browser hit a timeout page.
- This function gives a clear error message.

### `waitForDashboard(page)`

Purpose:

- Wait until the `Open AgileMapping` button is visible.

Meaning:

- The dashboard is ready.

### `recoverDashboardSession(page)`

Purpose:

- Recover if the user gets sent back to `/signin`.

How it works:

1. Check if the sign-in button is visible or the URL contains `/signin`
2. If yes, click sign-in
3. Wait for the popup to close
4. Wait until we are back in the app

Why this matters:

- The session can expire
- The app can redirect to sign-in unexpectedly
- This function fixes that without forcing every spec to repeat login code

### `openDashboard(page)`

Purpose:

- Open the app homepage safely
- Recover login if needed
- Retry once if dashboard loading fails

How it works:

1. Go to `BASE_URL`
2. Check that the browser did not land on an error page
3. Recover login if needed
4. Wait for the dashboard
5. If that fails, reload and try again

This is a stability function.

### `openAgileMapping(page)`

Purpose:

- Open the Train Document page from the dashboard

How it works:

1. Open dashboard
2. Find `Open AgileMapping`
3. Click it
4. Wait for Train Document page signals
5. Retry once if needed

The page is considered ready when one of these appears:

- the `Train Document` heading
- the output filename textbox

### `newAuthenticatedContext(browser)`

Purpose:

- Create a new browser context using the saved login state

Why it matters:

- This gives us a clean logged-in browser without repeating SSO

---

## 9. `training-setup.ts` explained

File: [tests/helpers/training-setup.ts](C:\Users\Aaron Sequeira\Agile Writer Test\tests\helpers\training-setup.ts)

This is the most important helper file for AW_13 and beyond.

It solves two problems:

1. starting a trained workspace is expensive
2. mapping tests all need the same base setup

### Constants

```ts
const TRAINING_TIMEOUT = 2_100_000;
const UI_TIMEOUT = 60_000;
```

- `TRAINING_TIMEOUT` is very large because training can take a long time
- `UI_TIMEOUT` is for normal UI checks

### `TrainingSession` interface

```ts
export interface TrainingSession {
  trainUrl: string;
  outputFileName: string;
}
```

This stores:

- the trained page URL
- the generated output filename

We save this once and reuse it.

### `ensureWorkspaceHealthy(page, step)`

Purpose:

- Check whether the app is still usable while waiting

It checks for:

- Chromium network timeout page
- redirect to `/signin`

This avoids confusing errors later.

### Locator helper functions

Examples:

- `firstPlaceholder(page)`
- `applyAllButton(page)`
- `createFinalDocButton(page)`
- `mappingControlsHeading(page)`
- `sourcesToggle(page)`
- `writingInstructionsToggle(page)`
- `addSourceButton(page)`
- `removeSourceButton(page)`
- `transformButton(page)`
- `applyButton(page)`
- `acceptPendingChangesButton(page)`
- `instructionEditor(page)`
- `transformEditor(page)`

Why we made them:

- one locator can be reused in many files
- if the UI changes, we update it in one place
- test files stay shorter and easier to read

### `appliedMappingsToast(page)` and `savedChangesToast(page)`

Purpose:

- check for success notifications without using very strict exact text

Why this matters:

- Agile Writer text changes a little across runs
- flexible patterns reduce false failures

### `dismissNotificationIfVisible(page)`

Purpose:

- close pop-up notifications when they block clicks

### `waitForWorkspaceReady(page, options)`

This is one of the most important functions.

Purpose:

- wait until the training workspace is really ready

How it works:

1. make sure app is healthy
2. confirm URL looks like `/train?id=...`
3. wait for one strong signal that the workspace exists
4. wait for mapping/document panel controls
5. if `requireApplyAll` is true, wait for `Create Final Doc` to be enabled and `Apply All` to be visible
6. make sure the first placeholder is visible

Why this is better than before:

- earlier logic waited for exact placeholder status text
- that was brittle
- now we wait for stable UI outcomes

### `selectDestinationTemplate(page)`

Purpose:

- choose the destination template file

What it does:

1. click `Select destination template`
2. wait for search box
3. search for `CSR_Table_Trimmed.docx`
4. expand the CSR folder
5. check the file
6. click Select

### `selectSourceDocuments(page)`

Purpose:

- choose the source document file

What it does:

1. click `Select source documents`
2. search for `Protocol Example (28Sep2023)_trimmed.docx`
3. expand the Protocol folder
4. check the file
5. click Done

### `createTrainingSession(page)`

This is the heart of the mapping setup.

Purpose:

- create one trained workspace for all later mapping tests

What it does:

1. open AgileMapping
2. create a unique output filename using time
3. select the destination template
4. select the source document
5. click Start Training
6. wait until the workspace is really ready
7. return the session object

Why the filename uses `Date.now()`:

- it prevents collisions between test runs

### `restoreTrainingSession(page, session)`

Purpose:

- reopen the already-trained workspace before each test

How it works:

1. go directly to the saved trained URL
2. if redirected to `/signin`, reopen dashboard
3. wait for workspace ready again
4. retry once if needed

Why this matters:

- we avoid retraining for every test
- tests become much faster
- the suite becomes more stable

### `openFirstPlaceholder(page)`

Purpose:

- click the first placeholder and open Mapping Controls

This is a shared starting point for AW_13 to AW_18.

### `ensureSourcesSectionOpen(page)`

Purpose:

- make sure the Sources section is open before checking source actions

How it works:

- if transform, add source, and remove source are not visible, click `Sources`
- then confirm one of the source action buttons appears

### `ensureWritingInstructionsOpen(page)`

Purpose:

- make sure the Writing Instructions editor is open

How it works:

- if the editor is not visible, click the section toggle
- then return the editor locator

---

## 10. Common test file pattern

Most mapping test files follow the same structure.

### Part 1: imports

The file imports:

- Playwright test tools
- auth helper
- training helpers

### Part 2: serial mode and timeout

Example:

```ts
test.describe.configure({ mode: 'serial', retries: 2, timeout: 2_100_000 });
test.setTimeout(2_100_000);
```

Why:

- `serial` keeps shared-session tests safe
- `retries: 2` helps if the app has a one-time failure
- long timeout is needed for training-related setup

### Part 3: shared setup variables

Example:

```ts
let setupContext: BrowserContext;
let setupPage: Page;
let session: TrainingSession;
```

Meaning:

- `setupContext`: the logged-in browser context used to build training
- `setupPage`: the setup page
- `session`: the saved training result

### Part 4: `beforeAll`

Example:

```ts
setupContext = await newAuthenticatedContext(browser);
setupPage = await setupContext.newPage();
session = await createTrainingSession(setupPage);
```

Meaning:

- create one logged-in browser
- open one page
- train once
- reuse it for every test in the file

### Part 5: `beforeEach`

Example:

```ts
await restoreTrainingSession(page, session);
```

Meaning:

- before every test, go back to the trained workspace

### Part 6: actual test body

The test body should:

1. open the right panel or state
2. perform the action from the Excel row
3. verify a real outcome

---

## 11. How the updated scripts work

### AW_06 and AW_07

File: [tests/AW_06_destination_template.spec.ts](C:\Users\Aaron Sequeira\Agile Writer Test\tests\AW_06_destination_template.spec.ts)

What this file teaches:

- how to test a picker dialog
- how to search known files
- how to verify preview
- how to confirm the selected file returns to Train Document

Important helper idea:

- small local functions like `openDestinationTemplatePicker(page)` and `searchKnownTemplate(page)` keep the spec readable

### AW_08 to AW_10

File: [tests/AW_08_10_source_selection.spec.ts](C:\Users\Aaron Sequeira\Agile Writer Test\tests\AW_08_10_source_selection.spec.ts)

What changed:

- the old direct provider-button logic was removed
- the current app uses a provider/search/tree flow

What this file teaches:

- open picker
- search source file
- expand folder
- select file
- preview file

### AW_13

File: [tests/AW_13_mapping_control_panel.spec.ts](C:\Users\Aaron Sequeira\Agile Writer Test\tests\AW_13_mapping_control_panel.spec.ts)

Purpose:

- verify Mapping Controls opens
- verify source/instruction actions are present

Important design choice:

- we do not retest training details here
- we only verify the AW_13 workflow

### AW_14

File: [tests/AW_14_delete_source.spec.ts](C:\Users\Aaron Sequeira\Agile Writer Test\tests\AW_14_delete_source.spec.ts)

Purpose:

- verify Remove source is present
- verify removing creates a pending-change or save/apply path

Important design choice:

- the script allows more than one valid UI outcome
- this is good when the app can show slightly different states

### AW_15

File: [tests/AW_15_add_source.spec.ts](C:\Users\Aaron Sequeira\Agile Writer Test\tests\AW_15_add_source.spec.ts)

This file is important because it fixed a false positive.

Before:

- the test only opened Add Source and looked green

Now:

1. open Add Source
2. choose the source document
3. choose a heading
4. save
5. verify pending add state

Important local helpers:

- `selectSourceHeading(page)`
- `sourcePickerDocument(page)`
- `createTrainingSessionWithRetry(browser)`

Why `createTrainingSessionWithRetry()` was added:

- setup was sometimes failing before the real test started
- this gives AW_15 one more chance to build the training session

### AW_16

File: [tests/AW_16_transform.spec.ts](C:\Users\Aaron Sequeira\Agile Writer Test\tests\AW_16_transform.spec.ts)

Purpose:

- open Transform
- verify editor appears
- submit transform text
- verify transformed content signals

### AW_17

File: [tests/AW_17_update_instruction.spec.ts](C:\Users\Aaron Sequeira\Agile Writer Test\tests\AW_17_update_instruction.spec.ts)

Purpose:

- rewrite the instruction text
- verify the editor stores the new value
- open Preview and verify preview signals

### AW_18

File: [tests/AW_18_reset.spec.ts](C:\Users\Aaron Sequeira\Agile Writer Test\tests\AW_18_reset.spec.ts)

Purpose:

- edit instruction
- click Reset
- confirm the original pattern comes back

Important detail:

- the final regex accepts both `sponsor name` and `sponsor's name`
- this makes the test less brittle

### AW_19

File: [tests/AW_19_create_final_doc.spec.ts](C:\Users\Aaron Sequeira\Agile Writer Test\tests\AW_19_create_final_doc.spec.ts)

Purpose:

- click `Create Final Doc`
- confirm navigation to `/review?id=...`
- confirm Review Screen and Save button appear

### AW_20

File: [tests/AW_20_save_integration_validation.spec.ts](C:\Users\Aaron Sequeira\Agile Writer Test\tests\AW_20_save_integration_validation.spec.ts)

Purpose:

- enter the final document flow
- click Save
- verify download or download-ready state

Important helpers in this file:

- `saveButton(page)`
- `finalDocumentSignal(page)`
- `postSaveSignal(page)`
- `logState(page, label)`
- `openFinalDocumentFlow(page)`

Why this file is strong:

- it does not depend on just one UI signal
- it handles the real download event when available
- if download event does not arrive, it still checks visible post-save results

---

## 12. How we converted the Excel flow into automation

This is the exact mindset to use when reading the Excel sheet.

### Step 1: read the row carefully

Usually Excel gives:

- test case ID
- action
- expected result

Example:

- Action: Click Save
- Expected result: Document downloads successfully

### Step 2: turn the row into manual steps

Ask:

- where does this flow start?
- what screen must already exist?
- what action is the user doing?
- what visible result proves success?

### Step 3: identify prerequisites

For example:

- AW_20 cannot start directly
- first we need login
- then Train Document
- then training workspace
- then final document review screen

### Step 4: choose the smallest real proof

Bad proof:

- "some modal opened"

Good proof:

- review URL opened
- Save button visible
- download event started
- pending add state visible

### Step 5: write helper functions if the setup repeats

If the same logic is repeated in many files, move it to a helper.

Examples:

- open dashboard
- open AgileMapping
- create training session
- open first placeholder

### Step 6: use resilient locators

Best options:

- `getByRole`
- `getByLabel`
- `getByText` with regex

Avoid:

- long CSS selectors
- exact dynamic text that changes after mapping

### Step 7: allow real-world app slowness

Use:

- larger timeouts
- retries
- helper recovery

### Step 8: run the script alone first

Always validate the new spec by itself before running a large suite.

---

## 13. How to create a new script from Excel

Use this checklist every time.

### Template workflow

1. Pick the Excel row
2. Write the user action in plain English
3. Write the expected result in plain English
4. Identify whether the case belongs to:
   - Train Document flow
   - Mapping flow
   - Final document flow
5. Reuse the right helper
6. Build one test for one clear outcome
7. Run it alone
8. Improve the locator if it is brittle
9. Add retries only after the test logic is correct

### Example

Excel row:

- Click Save
- Document downloads successfully

Script thinking:

1. Need trained session
2. Need final doc review screen
3. Click Save
4. Wait for download event
5. If download event is missed, verify a download-ready screen or saved state

That is exactly how AW_20 was built.

---

## 14. How to write a good automation script

### Rule 1: test behavior, not just visibility

Bad:

- "button is visible"

Better:

- "button is visible, clickable, and leads to the correct result"

### Rule 2: avoid false positives

A script should not pass just because the first step worked.

Example:

- Add Source is not done when the modal opens
- it is only done when source + heading + save + pending state are confirmed

### Rule 3: prefer outcome-based assertions

Examples:

- URL changed
- button became enabled
- toast appeared
- text changed
- download started

### Rule 4: use shared helpers for repeated setup

This keeps test files short and easier to maintain.

### Rule 5: keep one test focused

Do not try to test too many unrelated outcomes in one case.

---

## 15. Common problems we faced and how we solved them

### Problem 1: repeated Microsoft login failures

Solution:

- use `storageState`
- login once in `AW_00_auth.setup.ts`

### Problem 2: app redirects to `/signin`

Solution:

- `recoverDashboardSession()`

### Problem 3: browser lands on a network error page

Solution:

- `assertAppIsReachable()`

### Problem 4: training takes too long

Solution:

- large training timeout
- shared trained session

### Problem 5: tests were waiting on brittle exact text

Solution:

- replace exact status waits with stable UI signals

### Problem 6: false green in AW_15

Solution:

- test the full Add Source path, not just dialog open

### Problem 7: old UI locators stopped matching

Solution:

- rewrite scripts for the current picker and drawer flows

---

## 16. How to debug a failing test

Use this order:

1. Read the test name
2. Read the Playwright error
3. Check whether the failure is:
   - wrong locator
   - slow UI
   - sign-in redirect
   - network page
   - invalid assertion
4. Open `test-results/`
5. Check trace, screenshots, and error context
6. Rerun only the failing file
7. Fix the smallest real cause

Helpful questions:

- Did the page open?
- Did the right panel open?
- Did the element exist but appear late?
- Did the app show a different valid result?
- Did the app itself fail?

---

## 17. Useful commands

Run one test file:

```powershell
npx playwright test tests/AW_15_add_source.spec.ts --reporter=line
```

Run multiple files:

```powershell
npx playwright test "tests/(AW_13_mapping_control_panel|AW_14_delete_source|AW_15_add_source)\.spec\.ts" --reporter=line
```

Open HTML report:

```powershell
npx playwright show-report
```

---

## 18. Future steps

These are the best next improvements.

### 1. Create a shared document picker helper

Right now some picker logic is repeated between source and template flows.

Future improvement:

- one helper for search
- one helper for folder expand
- one helper for file select

### 2. Create a base mapping fixture

Many AW_13 to AW_20 files repeat the same `beforeAll`, `beforeEach`, and `afterAll`.

Future improvement:

- move this into one reusable fixture

### 3. Improve report cleanliness

The suite now produces many large result artifacts.

Future improvement:

- keep only the most useful traces
- organize reports per run or per feature group

### 4. Separate environment failures from test failures

Future improvement:

- label sign-in failure, timeout page, or missing config as environment issues

### 5. Add better comments for business logic

Some specs are now stable, but a few areas can be documented more clearly for future maintainers.

### 6. Coordinate AW_12 / AW_12B with owner

These areas should be stabilized carefully so they do not conflict with current mapping flows.

---

## 19. Best practices to follow from now on

- Reuse helpers instead of copying setup steps
- Use saved auth for non-login tests
- Train once, reuse many times
- Prefer `getByRole` and regex text over fragile selectors
- Verify real user outcomes, not just UI appearance
- Run new scripts alone first
- Check traces before changing assertions
- If the app is unstable, make the script tolerant but still meaningful

---

## 20. Simple recipe for building the next Excel-based script

When you take the next Excel row, do this:

1. Read the action and expected result
2. Identify the starting page
3. Check if a helper already gives that starting state
4. Write small local helper functions if needed
5. Use stable locators
6. Assert the real end result
7. Run the test alone
8. Save report and evidence

If you follow this recipe, your new script will match the current framework style.

---

## 21. Final summary

The big thing we accomplished was this:

- we stopped treating each test as a separate fresh login + fresh training problem
- we turned the project into a reusable, shared-flow automation framework

That is why the newer scripts are more stable:

- login is cached
- dashboard has recovery logic
- training is shared
- mapping state is restored
- assertions are based on outcomes, not fragile text

That same method should be used for future Excel-based Agile Writer automation work.
