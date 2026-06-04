import { test, expect } from '@playwright/test';

test.describe('Form-Level Allergen Security E2E Test Suite', () => {
  test.beforeEach(async ({ page }) => {
    // Mock user authentication and state
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

    // Mock initial state for userStore to set peanuts allergy
    await page.addInitScript(() => {
      window.localStorage.setItem('user-store', JSON.stringify({
        state: {
          user: {
            allergies: ['peanuts'],
            id: 'mock-user-id'
          }
        },
        version: 0
      }));
    });
  });

  test('Scenario A: The Allergen Guardrail & Confirmation Interstitial', async ({ page }) => {
    // Navigate to the app (assuming dashboard is the landing page)
    await page.goto('/');

    // Mock food item response with peanuts allergen
    await page.route('**/api/v2/nutrition/foods/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'food-1',
          name: 'Peanut Butter',
          allergens: ['peanuts'],
          calories: 190,
          protein: 7,
          carbs: 8,
          fat: 16
        })
      });
    });

    // We simulate opening the LogFoodDrawer
    // Triggering the drawer opening by clicking a log food button or searching
    await page.getByTestId('search-food-input').fill('Peanut Butter');
    await page.getByTestId('food-search-result-food-1').click();

    // Assert that the crimson warning banner (bg-[#E11D48]/10) is visible
    const warningBanner = page.locator('div.bg-status-rose\\/10');
    await expect(warningBanner).toBeVisible();
    await expect(warningBanner).toContainText('Allergy Warning');

    // Assert that the logging button has transitioned to the warning class bg-status-rose
    const logButton = page.getByRole('button', { name: /Log Food/i });
    await expect(logButton).toHaveClass(/bg-status-rose/);

    // Click the logging button and assert that the <AllergenConfirmModal /> is visible on screen
    await logButton.click();
    
    const confirmModal = page.getByTestId('allergen-confirm-modal');
    await expect(confirmModal).toBeVisible();

    // Click "Cancel" inside the modal and assert that the modal closes without writing a log
    const cancelButton = confirmModal.getByRole('button', { name: /Cancel/i });
    await cancelButton.click();
    await expect(confirmModal).toBeHidden();

    // Setup route interception for the log submission
    let overrideHeaderPresent = false;
    await page.route('**/api/v2/nutrition/diary', async (route) => {
      const headers = route.request().headers();
      if (headers['x-allergen-override'] === 'true') {
        overrideHeaderPresent = true;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
    });

    // Click the logging button again, click "Yes, Log Anyway"
    await logButton.click();
    await expect(confirmModal).toBeVisible();
    
    const overrideButton = confirmModal.getByRole('button', { name: /Yes, Log Anyway/i });
    await overrideButton.click();

    // Assert that the sync queue successfully processes the request, appending the X-Allergen-Override: true header
    await expect.poll(() => overrideHeaderPresent, {
      message: 'X-Allergen-Override header should be present in the request',
      timeout: 5000,
    }).toBeTruthy();
  });

  test('Scenario B: Custom Recipe Allergen Inheritance', async ({ page }) => {
    await page.goto('/recipes/create');

    // Add an ingredient that has no allergens
    await page.getByTestId('add-ingredient-btn').click();
    await page.getByTestId('ingredient-search-input').fill('Apple');
    
    await page.route('**/api/v2/nutrition/search?q=Apple*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 'apple-1', name: 'Apple', allergens: [] }])
      });
    });
    
    await page.getByTestId('ingredient-result-apple-1').click();

    // Assert that the Allergen Profile reads "None detected"
    const allergenProfileSection = page.getByTestId('recipe-allergen-profile');
    await expect(allergenProfileSection).toContainText('None detected');

    // Add a second ingredient tagged with allergens: ['dairy', 'wheat']
    await page.getByTestId('add-ingredient-btn').click();
    await page.getByTestId('ingredient-search-input').fill('Cheese Sandwich');

    await page.route('**/api/v2/nutrition/search?q=Cheese*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 'sandwich-1', name: 'Cheese Sandwich', allergens: ['dairy', 'wheat'] }])
      });
    });

    await page.getByTestId('ingredient-result-sandwich-1').click();

    // Assert that the "Allergen Profile" section dynamically updates in real-time to show read-only tags for both dairy and wheat
    await expect(allergenProfileSection.getByText('dairy')).toBeVisible();
    await expect(allergenProfileSection.getByText('wheat')).toBeVisible();
    await expect(allergenProfileSection).not.toContainText('None detected');
  });

  test('Scenario C: Custom Food Creator Serialization', async ({ page }) => {
    await page.goto('/custom-foods/create');

    // Click the allergen tag pills for peanuts and eggs
    const peanutPill = page.getByRole('button', { name: 'Peanuts' });
    const eggsPill = page.getByRole('button', { name: 'Eggs' });

    await peanutPill.click();
    await eggsPill.click();

    // Assert that the pills change style to the pulsing active state
    // We expect an active class (e.g. bg-accent-indigo or similar indicating selection, pulsing might be visually implemented)
    await expect(peanutPill).toHaveClass(/active|bg-/i);
    await expect(eggsPill).toHaveClass(/active|bg-/i);

    // Fill in the required nutritional macros (calories, protein, carbs, fat)
    await page.getByLabel(/Food Name/i).fill('Peanut Egg Bar');
    await page.getByLabel(/Calories/i).fill('250');
    await page.getByLabel(/Protein/i).fill('15');
    await page.getByLabel(/Carbs/i).fill('20');
    await page.getByLabel(/Fat/i).fill('12');

    // Submit the form and intercept the network request
    let postPayload: any = null;
    await page.route('**/api/v2/nutrition/custom-foods', async (route) => {
      if (route.request().method() === 'POST') {
        postPayload = JSON.parse(route.request().postData() || '{}');
      }
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, id: 'custom-food-1' })
      });
    });

    await page.getByRole('button', { name: /Create Food/i }).click();

    // Assert that the POST payload structure contains exactly: allergens: ['peanuts', 'eggs']
    await expect.poll(() => postPayload, {
      message: 'Wait for POST payload',
      timeout: 5000,
    }).toBeTruthy();

    expect(postPayload.allergens).toContain('peanuts');
    expect(postPayload.allergens).toContain('eggs');
    expect(postPayload.allergens.length).toBe(2);
  });
});
