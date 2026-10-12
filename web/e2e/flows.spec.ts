import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const demoAs = (page: Page, userId: string) => page.locator('#demo-user').selectOption(userId);

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('landing explains the pilot without overclaiming', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Share the seats already on the road.' })).toBeVisible();
  await expect(page.getByText('availability isn’t guaranteed')).toBeVisible();
  await expect(page.getByText('We don’t verify identity, licences or insurance.')).toBeVisible();
  await expectNoHorizontalScroll(page);
});

test('signed-out visitor can search; driver identity hidden', async ({ page }) => {
  await page.getByRole('link', { name: 'Find a ride' }).first().click();
  await page.getByLabel('Pickup zone').selectOption({ label: 'Newton' });
  await page.getByLabel('Drop-off zone').selectOption({ label: 'White Rock Town Centre' });
  await expect(page.getByText(/\d+ trips? · Tomorrow/)).toBeVisible();
  await expect(page.getByText('Sign in to see the driver').first()).toBeVisible();
  await expectNoHorizontalScroll(page);
  // Reverse direction with no matching morning trip → unmet-demand CTA when filtered
  await page.getByRole('button', { name: /Filters/ }).click();
  await page.getByLabel('Leaving after').fill('22:00');
  await expect(page.getByRole('link', { name: 'Tell us the ride you need' })).toBeVisible();
});

test('passenger requests, driver accepts, passenger sees meeting point', async ({ page }) => {
  await demoAs(page, 'u-marco');
  await page.goto('/search?pickup=3&dropoff=8');
  await page.getByRole('link', { name: /Harj S\./ }).first().click();
  await expect(page.getByText('Exact meeting point', { exact: true })).toHaveCount(0);
  await page.getByLabel('Message to driver (optional)').fill('Thanks!');
  await page.getByRole('button', { name: 'Send request' }).click();
  await expect(page.getByText('Pending')).toBeVisible();

  await demoAs(page, 'u-harj');
  await page.goto('/bookings?tab=driver');
  await page.getByRole('button', { name: 'Accept' }).first().click();
  await expect(page.getByText('Accepted').first()).toBeVisible();

  await demoAs(page, 'u-marco');
  await page.goto('/bookings');
  await page.getByRole('link', { name: /Driver: Harj S\./ }).first().click();
  await expect(page.getByText('Guildford Recreation Centre lot', { exact: true })).toBeVisible();
  await page.getByLabel('Message', { exact: true }).fill('See you there');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByText('See you there')).toBeVisible();
  await expectNoHorizontalScroll(page);
});

test('new user signs up and completes onboarding with consents', async ({ page }) => {
  await page.goto('/signup');
  await page.getByLabel('Email').fill('newbie@example.test');
  await page.getByLabel('Password').fill('correct-horse');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'I’ve confirmed my email' }).click();
  await page.getByLabel('Display name').fill('Alex N.');
  await page.getByLabel('Full name').fill('Alex Newbie');
  await page.getByRole('button', { name: 'Finish' }).click();
  await expect(page.getByText(/18 or older/).last()).toBeVisible(); // rule enforced
  await page.getByLabel('I am 18 or older.').check();
  for (const n of ['I agree to the Terms of Use.', 'I have read the Privacy Notice.', 'I will follow the Community Safety Rules.']) await page.getByLabel(n).check();
  await page.getByRole('button', { name: 'Finish' }).click();
  await expect(page.getByRole('heading', { name: 'Find a ride' })).toBeVisible();
  await expect(page.locator('#demo-user')).toHaveValue(/^u-/);
});

test('driver publishes a trip with an intermediate stop', async ({ page }) => {
  await demoAs(page, 'u-mei');
  await page.goto('/offer');
  await page.getByLabel('Starting zone').selectOption({ label: 'Fleetwood' });
  await page.getByLabel('Destination zone').selectOption({ label: 'White Rock Waterfront' });
  await page.getByRole('button', { name: 'Semiahmoo Town Centre' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByLabel('Proposed contribution per passenger (CAD)').fill('20');
  await expect(page.getByRole('alert').filter({ hasText: 'above the pilot cap' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled();
  await page.getByLabel('Proposed contribution per passenger (CAD)').fill('6');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByLabel('Exact meeting point (optional)').fill('Fleetwood library entrance');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Publish trip' }).click();
  await expect(page.getByRole('heading', { name: 'Fleetwood → White Rock Waterfront' })).toBeVisible();
  await expect(page.getByText('Fleetwood library entrance')).toBeVisible(); // driver sees own private details
});

test('passenger completes post-trip survey', async ({ page }) => {
  await demoAs(page, 'u-priya');
  await page.goto('/bookings');
  await page.getByRole('link', { name: /How did your trip go/ }).click();
  await page.getByText('Yes', { exact: true }).first().click();
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByText('Completed').first()).toBeVisible();
});

test('admin triages a report, suspends a user, and exports anonymized CSV', async ({ page }) => {
  await demoAs(page, 'u-admin');
  await page.goto('/admin');
  await expect(page.getByText('Pilot targets')).toBeVisible();
  await page.getByRole('tab', { name: /Reports/ }).click();
  await page.getByRole('button', { name: 'reviewing' }).first().click();
  await page.getByRole('tab', { name: 'Users' }).click();
  await page.getByRole('row', { name: /Marco T\./ }).getByRole('button', { name: 'Suspend' }).click();
  await page.getByLabel('Reason (shown to the user)').fill('Test suspension');
  await page.getByRole('button', { name: 'Suspend account' }).click();
  await expect(page.getByRole('row', { name: /Marco T\./ }).getByText('Suspended')).toBeVisible();
  await page.getByRole('tab', { name: 'Export & settings' }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download CSV' }).click()]);
  const path = await download.path();
  const csv = readFileSync(path, 'utf8');
  expect(csv.split('\n')[0]).toContain('departure_date');
  expect(csv).not.toMatch(/Priya|Marco|example\.test/);
});

test('suspended user cannot request a seat', async ({ page }) => {
  await demoAs(page, 'u-admin');
  await page.goto('/admin');
  await page.getByRole('tab', { name: 'Users' }).click();
  await page.getByRole('row', { name: /Marco T\./ }).getByRole('button', { name: 'Suspend' }).click();
  await page.getByLabel('Reason (shown to the user)').fill('Test');
  await page.getByRole('button', { name: 'Suspend account' }).click();
  await demoAs(page, 'u-marco');
  await page.goto('/search?pickup=3&dropoff=8');
  await page.getByRole('link', { name: /Harj S\./ }).first().click();
  await page.getByRole('button', { name: 'Send request' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'suspended' }).first()).toBeVisible();
});
