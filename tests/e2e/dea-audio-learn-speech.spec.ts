import { test, expect, type Page } from '@playwright/test';

declare global {
  interface Window {
    __speechCalls: Array<Record<string, unknown>>;
  }
}

async function gotoAudioLearn(page: Page) {
  await page.goto('/dea-audio-learn/');
  await expect(page.getByRole('heading', { name: 'DEA Audio Learn' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: /Databricks Intelligence Platform/ })
  ).toBeVisible();
}

test.describe('[DEA Audio Learn][Phase 4] Speech controls', () => {
  test('uses one button to play, pause, resume, and resets on chapter change', async ({ page }) => {
    await page.addInitScript(() => {
      window.__speechCalls = [];
      class MockSpeechSynthesisUtterance {
        text: string;
        lang = '';
        rate = 1;
        onend: (() => void) | null = null;
        onerror: (() => void) | null = null;

        constructor(text: string) {
          this.text = text;
        }
      }
      window.SpeechSynthesisUtterance =
        MockSpeechSynthesisUtterance as typeof SpeechSynthesisUtterance;
      window.speechSynthesis = {
        speak: (utterance: SpeechSynthesisUtterance) =>
          window.__speechCalls.push({
            type: 'speak',
            text: utterance.text,
            lang: utterance.lang,
            rate: utterance.rate,
          }),
        pause: () => window.__speechCalls.push({ type: 'pause' }),
        resume: () => window.__speechCalls.push({ type: 'resume' }),
        cancel: () => window.__speechCalls.push({ type: 'cancel' }),
        getVoices: () => [
          {
            name: 'Mock Japanese Voice',
            lang: 'ja-JP',
            default: true,
            localService: true,
            voiceURI: 'mock-ja-JP',
          },
        ],
        addEventListener: () => undefined,
        pending: false,
        speaking: false,
        paused: false,
      } as unknown as SpeechSynthesis;
    });

    await gotoAudioLearn(page);

    await expect(page.getByText('聞く').locator('..')).toContainText('利用可能');
    await expect(page.locator('#speech-status')).toHaveText('状態：未再生');
    await expect(page.locator('#speech-toggle')).toHaveText('再生');

    await page.locator('#speech-rate').selectOption('1.2');
    await page.locator('#speech-toggle').click();
    await expect(page.locator('#speech-toggle')).toHaveText('一時停止');
    await expect(page.locator('#speech-status')).toHaveText('状態：読み上げ中');

    await page.locator('#speech-toggle').click();
    await expect(page.locator('#speech-toggle')).toHaveText('再開');
    await expect(page.locator('#speech-status')).toHaveText('状態：一時停止中');

    await page.locator('#speech-toggle').click();
    await expect(page.locator('#speech-toggle')).toHaveText('一時停止');

    await page.getByRole('button', { name: /LakehouseとDelta Lake/ }).click();
    await expect(page.locator('#speech-toggle')).toHaveText('再生');
    await expect(page.locator('#speech-status')).toHaveText('状態：未再生');

    const calls = await page.evaluate(() => window.__speechCalls);
    expect(calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'speak', lang: 'ja-JP', rate: 1.2 }),
        expect.objectContaining({ type: 'pause' }),
        expect.objectContaining({ type: 'resume' }),
        expect.objectContaining({ type: 'cancel' }),
      ])
    );
    const speakCall = calls.find((call) => call.type === 'speak');
    expect(speakCall?.text).not.toContain('#');
  });

  test('disables speech UI when Web Speech API is unavailable', async ({ page }) => {
    await page.addInitScript(() => {
      delete window.SpeechSynthesisUtterance;
      delete window.speechSynthesis;
    });

    await gotoAudioLearn(page);

    await expect(page.locator('#speech-toggle')).toBeDisabled();
    await expect(page.locator('#speech-toggle')).toHaveText('利用不可');
    await expect(page.locator('#speech-status')).toHaveText(
      '状態：このブラウザでは読み上げに対応していません'
    );
    await expect(page.locator('#speech-message')).toContainText(
      'このブラウザでは読み上げ機能に対応していません。'
    );
  });
});
