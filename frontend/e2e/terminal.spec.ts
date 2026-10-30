import { expect, test, type Page } from '@playwright/test'

async function boot(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: /skip boot|press enter/i }).click()
  await expect(page.getByLabel('Terminal output')).toContainText('Welcome to PeteOS')
}

async function type(page: Page, command: string) {
  const input = page.getByLabel('Type a command')
  await input.fill(command)
  await input.press('Enter')
}

const log = (page: Page) => page.getByLabel('Terminal output')

test('boot can be skipped and is remembered for the session', async ({ page }) => {
  await boot(page)
  await page.reload()
  await expect(log(page)).toContainText('Welcome to PeteOS')
})

test('filesystem session: mkdir, cd, redirect, cat', async ({ page }) => {
  await boot(page)
  await type(page, 'mkdir experiments')
  await type(page, 'cd experiments')
  await expect(page.getByText('prakash@peteos:~/experiments$').last()).toBeVisible()
  await type(page, 'echo "Hello PeteOS" > hello.txt')
  await type(page, 'cat hello.txt')
  await expect(log(page)).toContainText('Hello PeteOS')
})

test('pipelines and errors', async ({ page }) => {
  await boot(page)
  await type(page, 'cat projects/relay4/README.md | grep -i "dispatcher"')
  await expect(log(page)).toContainText('single dispatcher can review')
  await type(page, 'cat missing.txt')
  await expect(log(page)).toContainText('cat: missing.txt: No such file or directory')
  await type(page, 'clear')
  await expect(log(page)).not.toContainText('Welcome')
})

test('clickable ls opens directories', async ({ page }) => {
  await boot(page)
  await type(page, 'ls')
  await log(page).getByRole('button', { name: 'projects', exact: true }).last().click()
  await expect(log(page)).toContainText('credence')
  await expect(page.getByText('prakash@peteos:~/projects$').last()).toBeVisible()
})

test('history, tab completion, ctrl+c', async ({ page }) => {
  await boot(page)
  const input = page.getByLabel('Type a command')
  await type(page, 'pwd')
  await input.press('ArrowUp')
  await expect(input).toHaveValue('pwd')
  await input.fill('cd proj')
  await input.press('Tab')
  await expect(input).toHaveValue('cd projects/')
  await input.press('Control+c')
  await expect(input).toHaveValue('')
  await expect(log(page)).toContainText('cd projects/^C')
})

test('theme and crt settings persist', async ({ page }) => {
  await boot(page)
  await type(page, 'theme amber')
  await type(page, 'crt off')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'amber')
  await expect(page.locator('html')).toHaveAttribute('data-crt', 'off')
})

test('side panel shows clock, weather and tracks cwd (desktop)', async ({ page, isMobile }) => {
  test.skip(isMobile, 'panel is hidden on narrow screens')
  await page.route('https://api.open-meteo.com/**', (route) =>
    route.fulfill({ json: { current: { temperature_2m: 71.6, weather_code: 0, is_day: 1 } } }),
  )
  await boot(page)
  const panel = page.getByRole('complementary', { name: 'System panel' })
  await expect(panel.getByRole('img', { name: /\d\d:\d\d (AM|PM)/ })).toBeVisible()
  await expect(panel.getByRole('img', { name: '72 degrees Fahrenheit' })).toBeVisible()
  await expect(panel).toContainText('Hammond, LA · clear')
  await panel.getByRole('button', { name: 'projects/' }).click()
  await expect(panel).toContainText('cwd ~/projects')
  await type(page, 'panel off')
  await expect(panel).toBeHidden()
})

test('defaults to the high-contrast theme', async ({ page }) => {
  await boot(page)
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'green-hc')
})
