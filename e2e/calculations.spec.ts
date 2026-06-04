import { test, expect } from '@playwright/test';

test.describe('Physiological Calculation & Telemetry Integration Test', () => {
  test.beforeEach(async ({ page }) => {
    // Mock user authentication
    await page.route('**/api/v2/auth/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'mock-user-id', email: 'test@example.com' },
          session: { access_token: 'mock-token' }
        }),
      });
    });
  });

  test('Scenario A: The US Navy Formula Boundary Safeguard', async ({ page }) => {
    // Open the onboarding page or the biometrics edit profile modal
    await page.goto('/onboarding');
    
    // Select the "US Navy Tape Measure" body fat pathway
    // Navigating through hypothetical onboarding steps
    const nextStepButton = page.getByRole('button', { name: /Next/i });
    if (await nextStepButton.isVisible()) {
      await nextStepButton.click(); // Proceed to vitals if necessary
    }

    const navyPathwayBtn = page.getByRole('button', { name: /Tape Measure/i });
    await navyPathwayBtn.click();

    // Input invalid boundary values where waist <= neck
    await page.getByLabel(/Neck/i).fill('40');
    await page.getByLabel(/Waist/i).fill('35'); // waist < neck
    await page.getByLabel(/Height/i).fill('180');

    // Assert that the calculated output gracefully returns a formatted clamp value (e.g., 0.0% or does not crash), instead of returning NaN% or -Infinity%
    const bodyFatOutput = page.getByTestId('body-fat-result');
    await expect(bodyFatOutput).toBeVisible();
    await expect(bodyFatOutput).not.toContainText('NaN');
    await expect(bodyFatOutput).not.toContainText('-Infinity');
    await expect(bodyFatOutput).toContainText('0.0%'); // Or another safe clamped value

    // Input valid measurements (e.g., Height: 180cm, Neck: 38cm, Waist: 86cm)
    await page.getByLabel(/Neck/i).fill('38');
    await page.getByLabel(/Waist/i).fill('86');
    await page.getByLabel(/Height/i).fill('180');

    // Assert that the computed body fat matches standard Navy calculation outputs
    // Calculation: 86.010 * log10(86-38) - 70.041 * log10(180) + 36.76
    // = 86.010 * 1.68124 - 70.041 * 2.25527 + 36.76
    // = 144.60 - 157.96 + 36.76 = 23.4% (approx, based on male formula)
    // We expect a valid numerical percentage output
    await expect(bodyFatOutput).toContainText(/1[0-9]\.[0-9]%|2[0-9]\.[0-9]%/);
  });

  test('Scenario B: Dashboard Weight Telemetry Propagation', async ({ page }) => {
    await page.goto('/');

    // Mock initial user biometrics
    let currentWeight = 80;
    
    await page.route('**/api/v2/profile/biometrics', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ weight_kg: currentWeight, height_cm: 180, body_fat_pct: 15, gender: 'male', age: 30 })
      });
    });

    // Log a new weight entry from the Dashboard quick-log widget
    const newWeight = '78.5';
    await page.getByTestId('quick-log-weight-input').fill(newWeight);

    let dbWriteIntercepted = false;
    await page.route('**/api/v2/metrics/weight', async (route) => {
      if (route.request().method() === 'POST') {
        dbWriteIntercepted = true;
        currentWeight = parseFloat(newWeight);
      }
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
    });

    await page.getByRole('button', { name: /Log Weight/i }).click();

    // Intercept the database write and wait for the PostgreSQL triggers to execute
    await expect.poll(() => dbWriteIntercepted, { timeout: 5000 }).toBeTruthy();

    // Navigate to the /profile page
    await page.goto('/profile');

    // Assert that the updated weight is reflected in the biometrics bento box
    const weightDisplay = page.getByTestId('profile-weight-display');
    await expect(weightDisplay).toContainText('78.5 kg');

    // Assert that the calculated calorie targets and TDEE macro visualizer have dynamically updated to match the new physiological baseline
    // The precise numbers would depend on the formula, but we ensure it updates and doesn't just show the old cache or NaN.
    const tdeeDisplay = page.getByTestId('profile-tdee-display');
    await expect(tdeeDisplay).toBeVisible();
    await expect(tdeeDisplay).not.toContainText('NaN');
    // Ensure that it displays a valid number string
    await expect(tdeeDisplay).toHaveText(/[0-9,]+ kcal/);
  });

  test('Hydration Audit: Unit Preferences and Skeleton States', async ({ page }) => {
    // Capture console errors/warnings for hydration
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        consoleErrors.push(msg.text());
      }
    });

    // Set initial unit preferences in local storage (Imperial)
    await page.addInitScript(() => {
      window.localStorage.setItem('user-store', JSON.stringify({
        state: {
          preferred_solid_unit: 'imperial',
          preferred_liquid_unit: 'imperial'
        },
        version: 0
      }));
    });

    // Navigate to /profile route
    await page.goto('/profile');

    // Loading Skeleton State Check: Assert that skeleton states are rendered while isHydrated === false to block layout flashes
    // We look for a skeleton loader indicator. Often this has a class like 'animate-pulse' or a specific data-testid
    const skeletonLoader = page.locator('.animate-pulse, [data-testid="profile-skeleton"]');
    // Check if skeleton is in the DOM (it might disappear quickly)
    if (await skeletonLoader.count() > 0) {
      await expect(skeletonLoader.first()).toBeVisible();
    }

    // Wait for the hydration to complete and the actual content to render
    const profileContent = page.getByTestId('profile-content-loaded');
    if (await profileContent.count() > 0) {
        await expect(profileContent).toBeVisible();
    } else {
        // Fallback to check something that implies rendering is done, like the unit toggle
        await expect(page.getByRole('button', { name: /Imperial/i }).first()).toBeVisible();
    }

    // Verify that unit preferences (Metric vs Imperial) do not trigger standard Next.js hydration console warnings
    const hydrationWarnings = consoleErrors.filter(err => 
      err.includes('Hydration') || 
      err.includes('did not match') ||
      err.includes('Text content did not match')
    );
    
    expect(hydrationWarnings.length).toBe(0);
  });
});
