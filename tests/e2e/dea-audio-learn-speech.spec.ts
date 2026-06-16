import { test, expect, type Page } from '@playwright/test';

declare global {
  interface Window {
    __speechCalls: Array<Record<string, unknown>>;
  }
}

async function gotoAudioLearn(page: Page) {
  await page.goto('/dea-audio-learn/');
  await expect(page.getByRole('heading', { name: 'DEA Audio Learn' })).toBeVisible();
  await expect(page.locator('#selected-chapter-title')).toHaveText(
    'Databricks Intelligence Platformの全体像'
  );
}

test.describe('[DEA][UI] Audio Learn / Speech controls', () => {
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
      Object.defineProperty(window, 'SpeechSynthesisUtterance', {
        configurable: true,
        value: MockSpeechSynthesisUtterance,
      });
      Object.defineProperty(window, 'speechSynthesis', {
        configurable: true,
        value: {
          speak: (utterance: SpeechSynthesisUtterance) =>
            window.__speechCalls.push({
              type: 'speak',
              text: utterance.text,
              lang: utterance.lang,
              rate: utterance.rate,
              voice: utterance.voice?.lang,
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
        } as unknown as SpeechSynthesis,
      });
    });

    await gotoAudioLearn(page);

    await expect(page.locator('.step-item').filter({ hasText: /^聞く利用可能$/ })).toBeVisible();
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
        expect.objectContaining({ type: 'speak', lang: 'ja-JP', rate: 1.2, voice: 'ja-JP' }),
        expect.objectContaining({ type: 'pause' }),
        expect.objectContaining({ type: 'resume' }),
        expect.objectContaining({ type: 'cancel' }),
      ])
    );
    const speakCall = calls.find((call) => call.type === 'speak');
    expect(speakCall?.text).not.toContain('#');
  });

  test('shows a clear unavailable message when no speech voices are available', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      class MockSpeechSynthesisUtterance {
        text: string;
        lang = '';
        voice: SpeechSynthesisVoice | null = null;

        constructor(text: string) {
          this.text = text;
        }
      }
      Object.defineProperty(window, 'SpeechSynthesisUtterance', {
        configurable: true,
        value: MockSpeechSynthesisUtterance,
      });
      Object.defineProperty(window, 'speechSynthesis', {
        configurable: true,
        value: {
          cancel: () => undefined,
          getVoices: () => [],
          addEventListener: () => undefined,
        } as unknown as SpeechSynthesis,
      });
    });

    await gotoAudioLearn(page);

    await expect(page.locator('#speech-toggle')).toBeDisabled();
    await expect(page.locator('#speech-toggle')).toHaveText('利用不可');
    await expect(page.locator('#speech-status')).toHaveText('状態：利用可能な音声がありません');
    await expect(page.locator('#speech-message')).toContainText(
      'このブラウザまたはOS環境で利用可能な読み上げ音声が見つかりません。'
    );
  });

  test('keeps synthesis-failed visible in the UI and returns the button to play', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const mockVoice = {
        name: 'Mock Japanese Voice',
        lang: 'ja-JP',
        default: true,
        localService: true,
        voiceURI: 'mock-ja-JP',
      } as SpeechSynthesisVoice;
      class MockSpeechSynthesisUtterance {
        text: string;
        lang = '';
        voice: SpeechSynthesisVoice | null = null;
        rate = 1;
        onerror: ((event: SpeechSynthesisErrorEvent) => void) | null = null;

        constructor(text: string) {
          this.text = text;
        }
      }
      Object.defineProperty(window, 'SpeechSynthesisUtterance', {
        configurable: true,
        value: MockSpeechSynthesisUtterance,
      });
      Object.defineProperty(window, 'speechSynthesis', {
        configurable: true,
        value: {
          speak: (utterance: SpeechSynthesisUtterance) =>
            utterance.onerror?.({ error: 'synthesis-failed' } as SpeechSynthesisErrorEvent),
          cancel: () => undefined,
          getVoices: () => [mockVoice],
          addEventListener: () => undefined,
          pending: false,
          speaking: false,
          paused: false,
        } as unknown as SpeechSynthesis,
      });
    });

    await gotoAudioLearn(page);
    await page.locator('#speech-toggle').click();

    await expect(page.locator('#speech-status')).toHaveText('状態：読み上げエラー');
    await expect(page.locator('#speech-toggle')).toBeEnabled();
    await expect(page.locator('#speech-toggle')).toHaveText('再生');
    await expect(page.locator('#speech-message')).toContainText(
      '読み上げに失敗しました（synthesis-failed）。'
    );
  });

  test('disables speech UI when Web Speech API is unavailable', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'SpeechSynthesisUtterance', {
        configurable: true,
        value: undefined,
      });
      Object.defineProperty(window, 'speechSynthesis', {
        configurable: true,
        value: undefined,
      });
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
