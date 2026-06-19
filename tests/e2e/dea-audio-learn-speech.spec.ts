import { readFileSync } from 'node:fs';

import { test, expect, type Page } from '@playwright/test';

const chapters = JSON.parse(
  readFileSync(new URL('../../dea-audio-learn/data/chapters.json', import.meta.url), 'utf8')
);
const firstChapter = chapters[0];
const quizzes = JSON.parse(
  readFileSync(new URL('../../dea-audio-learn/data/quizzes.json', import.meta.url), 'utf8')
);

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
          speak: (utterance: SpeechSynthesisUtterance) => {
            window.__speechCalls.push({
              type: 'speak',
              text: utterance.text,
              lang: utterance.lang,
              rate: utterance.rate,
              voice: utterance.voice?.lang,
            });
            utterance.onstart?.(new Event('start') as SpeechSynthesisEvent);
          },
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

    await expect(page.locator('#selected-minutes')).toHaveText(
      `音声目安：約${firstChapter.estimatedMinutes}分`
    );
    await expect(page.locator('#selected-status')).toHaveText(firstChapter.status);
    await expect(page.locator('#selected-chapter-no')).toHaveCount(0);
    await expect(page.locator('#selected-position')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: '音声教材' })).toBeVisible();
    await expect(page.locator('.summary-cue')).toBeVisible();
    await expect(page.getByRole('heading', { name: '読む教材' })).toHaveCount(0);
    await expect(page.locator('#content-markdown')).toHaveCount(0);
    await expect(page.locator('.step-item').filter({ hasText: /^聞く利用可能$/ })).toBeVisible();
    await expect(page.locator('.step-item').filter({ hasText: /^要点利用可能$/ })).toBeVisible();
    await expect(page.locator('.step-item').filter({ hasText: /^解く利用可能$/ })).toBeVisible();
    await expect(
      page.locator('.step-item').filter({ hasText: /^記録Phase 10で追加予定$/ })
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: '要点メモ' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'ミニクイズ' })).toBeVisible();
    await expect(page.locator('#mini-quiz-list .quiz-question')).toHaveCount(3);
    await expect(
      page.locator('#mini-quiz-list .quiz-question').first().locator('input[type="radio"]')
    ).toHaveCount(4);
    await expect(
      page.locator('#mini-quiz-list .quiz-question').first().locator('.quiz-choice span')
    ).toHaveText([/A\. /, /B\. /, /C\. /, /D\. /]);
    await expect
      .poll(() =>
        page
          .locator('#mini-quiz-list .quiz-question')
          .first()
          .locator('input[type="radio"]')
          .evaluateAll((inputs) =>
            inputs
              .map((input) => (input as HTMLInputElement).value)
              .sort()
              .join('')
          )
      )
      .toBe('ABCD');
    await page
      .locator('#mini-quiz-list .quiz-question')
      .first()
      .getByRole('button', { name: '回答する' })
      .click();
    await expect(
      page.locator('#mini-quiz-list .quiz-question').first().locator('.quiz-feedback')
    ).toContainText('選択肢を選んでから回答してください。');
    await page
      .locator('#mini-quiz-list .quiz-question')
      .first()
      .locator('input[type="radio"]')
      .first()
      .check();
    await page
      .locator('#mini-quiz-list .quiz-question')
      .first()
      .getByRole('button', { name: '回答する' })
      .click();
    await expect(
      page.locator('#mini-quiz-list .quiz-question').first().locator('.quiz-feedback')
    ).toContainText(/正解です。|不正解です。/);
    await expect(
      page.locator('#mini-quiz-list .quiz-question').first().locator('.quiz-feedback')
    ).toContainText('解説：');
    await expect(
      page.locator('#mini-quiz-list .quiz-question').first().locator('.quiz-references a').first()
    ).toHaveAttribute('target', '_blank');
    await expect(
      page.locator('#mini-quiz-list .quiz-question').first().locator('.quiz-references a').first()
    ).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(page.locator('#note-markdown')).toContainText(
      'Databricks Intelligence Platformは'
    );
    await expect(page.locator('#note-markdown')).not.toContainText('Phase 6で追加予定');
    await expect(page.locator('#audio-script-markdown')).toContainText('はじめに');
    await expect(page.locator('#audio-script-markdown')).toContainText('本チャプターのゴール');
    await expect(page.getByRole('heading', { name: '背景', level: 2 })).toBeVisible();
    await expect(page.locator('#audio-toc-list a').filter({ hasText: /^背景$/ })).toHaveCount(1);
    await expect(page.locator('.audio-toc__play')).toHaveCount(0);
    await expect(
      page.getByRole('heading', { name: '従来のデータ基盤の課題', level: 3 })
    ).toBeVisible();
    await expect(page.locator('#audio-script-markdown')).not.toContainText('導入');
    await expect(page.locator('#audio-script-markdown')).not.toContainText('今日のゴール');
    await expect(
      page.locator('#audio-script-markdown strong').filter({ hasText: '統合的な基盤' })
    ).toHaveCount(1);
    await expect(
      page.locator('#audio-script-markdown strong').filter({ hasText: '統合基盤' })
    ).toHaveCount(2);
    await expect(page.locator('#audio-script-markdown pre code.language-mermaid')).toContainText(
      'flowchart LR'
    );
    await expect(page.locator('.audio-card .audio-toc')).toHaveCount(0);
    await expect(page.locator('.chapter-panel #audio-toc-panel')).toContainText('この教材の目次');
    await expect(
      page.locator('.speech-controls + .speech-progress + #speech-message + #audio-script-markdown')
    ).toBeVisible();
    const isMobileViewport = await page.evaluate(
      () => window.matchMedia('(max-width: 780px)').matches
    );
    if (isMobileViewport) {
      await expect(page.locator('#audio-toc-panel')).not.toHaveAttribute('open', '');
    }
    await page.locator('#audio-toc-panel').evaluate((details) => {
      (details as HTMLDetailsElement).open = true;
    });
    await expect(page.locator('#audio-toc-list a').filter({ hasText: /^背景$/ })).toBeVisible();
    await expect(page.locator('#audio-toc-list a')).toContainText([
      'はじめに',
      '従来のデータ基盤の課題',
      '要点メモ',
      'ミニクイズ',
    ]);
    await expect(page.locator('#audio-toc-list a[href="#note-title"]')).toHaveText('要点メモ');
    await expect(page.locator('#audio-toc-list a[href="#mini-quiz-title"]')).toHaveText(
      'ミニクイズ'
    );
    await expect(page.locator('#audio-toc-list button', { hasText: '再生' })).toHaveCount(0);
    await expect(page.locator('#note-title .audio-heading-play')).toHaveCount(0);
    await expect(page.locator('#mini-quiz-title .audio-heading-play')).toHaveCount(0);
    await expect(
      page.locator('#audio-script-markdown h2', { hasText: '背景' }).locator('.audio-heading-play')
    ).toHaveText('▶');
    await expect(
      page
        .locator('#audio-script-markdown h3', { hasText: '従来のデータ基盤の課題' })
        .locator('.audio-heading-play')
    ).toHaveAttribute('aria-label', '従来のデータ基盤の課題から再生');
    await expect(page.locator('.toc-speech-controls')).toBeVisible();
    await page.getByRole('link', { name: '統合基盤で扱うという発想' }).click();
    await expect(page).toHaveURL(/#audio-heading-/);
    await expect(page.locator('#note-markdown')).toContainText('キーワード一覧');
    await expect(page.locator('#note-markdown')).toContainText('参考リンク');
    await expect(
      page.locator('#note-markdown a[href="https://docs.databricks.com/"]').first()
    ).toHaveAttribute('target', '_blank');
    await expect(
      page.locator('#note-markdown a[href="https://docs.databricks.com/"]').first()
    ).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(
      page.locator('#audio-script-markdown a[href="#lakehouse"]').first()
    ).not.toHaveAttribute('target', '_blank');
    await expect(page.getByRole('heading', { name: '学習ステップ' })).toBeVisible();
    await expect(page.locator('#audio-script-markdown h1')).toHaveCount(0);
    await expect(page.locator('#audio-script-markdown')).not.toContainText('音声スクリプト:');
    await expect(page.locator('#speech-status')).toHaveText('未再生');
    await expect(page.locator('#speech-toggle')).toHaveText('再生');
    await expect(page.locator('#speech-current-position')).toHaveText('現在：未再生');
    await expect(page.locator('#toc-speech-current-position')).toHaveText('現在：未再生');
    await expect(page.locator('#speech-progress-label')).toContainText('進捗：0 /');
    await expect(page.locator('#toc-speech-progress-label')).toContainText('進捗：0 /');
    await expect(page.locator('#speech-previous')).toBeDisabled();
    await expect(page.locator('#toc-speech-previous')).toBeDisabled();
    await expect(page.locator('#speech-next')).toBeDisabled();
    await expect(page.locator('#toc-speech-next')).toBeDisabled();
    await expect(page.locator('#speech-progress-bar')).toHaveJSProperty('value', 0);

    await page.locator('#speech-rate').selectOption('1.2');
    await page.locator('#speech-toggle').click();
    await expect(page.locator('#speech-toggle')).toHaveText('一時停止');
    await expect(page.locator('#speech-status')).toHaveText('読み上げ中');
    await expect(page.locator('#toc-speech-toggle')).toHaveText('一時停止');
    await expect(page.locator('#speech-current-position')).not.toHaveText('現在：未再生');
    await expect(page.locator('#speech-progress-label')).toContainText('進捗：1 /');
    await expect(page.locator('#speech-previous')).toBeDisabled();
    await expect(page.locator('#speech-next')).toBeEnabled();
    await expect(page.locator('#toc-speech-next')).toBeEnabled();

    await page.locator('#toc-speech-next').click();
    await expect(page.locator('#speech-progress-label')).toContainText('進捗：2 /');
    await expect(page.locator('#toc-speech-progress-label')).toContainText('進捗：2 /');
    await expect(page.locator('#speech-previous')).toBeEnabled();
    await expect(page.locator('#toc-speech-previous')).toBeEnabled();
    await page.locator('#toc-speech-previous').click();
    await expect(page.locator('#speech-progress-label')).toContainText('進捗：1 /');

    await page.locator('#toc-speech-toggle').click();
    await expect(page.locator('#speech-toggle')).toHaveText('再開');
    await expect(page.locator('#speech-status')).toHaveText('一時停止中');

    await page.locator('#speech-toggle').click();
    await expect(page.locator('#speech-toggle')).toHaveText('一時停止');

    await page.locator('#next-chapter').click();
    await expect(page.locator('#selected-chapter-title')).toHaveText(
      'LakehouseとDelta Lakeの位置づけ'
    );
    await expect(page.locator('#speech-toggle')).toHaveText('再生');
    await expect(page.locator('#speech-status')).toHaveText('未再生');
    await expect(page.locator('#speech-current-position')).toHaveText('現在：未再生');
    await expect(page.locator('#toc-speech-current-position')).toHaveText('現在：未再生');
    await expect(page.locator('#speech-progress-label')).toContainText('進捗：0 /');
    await expect(page.locator('#toc-speech-progress-label')).toContainText('進捗：0 /');
    await expect(page.locator('#speech-previous')).toBeDisabled();
    await expect(page.locator('#toc-speech-previous')).toBeDisabled();
    await expect(page.locator('#speech-next')).toBeDisabled();
    await expect(page.locator('#toc-speech-next')).toBeDisabled();
    await expect(page.locator('#note-markdown')).toContainText('Lakehouseは全体のアーキテクチャ');
    await expect(page.locator('#mini-quiz-list .quiz-question')).toHaveCount(3);
    await expect(page.locator('#mini-quiz-list')).toContainText(
      'Lakehouseの説明として最も適切なもの'
    );
    await expect(page.locator('#mini-quiz-list')).not.toContainText(
      'Databricks Intelligence Platformを理解するうえで'
    );
    await expect(page.locator('#audio-script-markdown')).toContainText('本チャプターのゴール');
    await expect(
      page.getByRole('heading', { name: 'データレイクだけでは困ること', level: 3 })
    ).toBeVisible();
    await expect(page.locator('#audio-toc-list')).toContainText(
      'Delta Lakeは信頼できるテーブル管理'
    );

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
    expect(speakCall?.voice).toBeUndefined();
    expect(speakCall?.text).not.toContain('#');
    expect(speakCall?.text).not.toContain('音声スクリプト:');
    expect(speakCall?.text).not.toContain('flowchart LR');
    expect(speakCall?.text).not.toContain('業務システム');
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
    await expect(page.locator('#speech-status')).toHaveText('利用不可');
    await expect(page.locator('#speech-message')).toContainText(
      'このブラウザまたはOS環境では、利用可能な読み上げ音声が見つかりません。'
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

    await expect(page.locator('#speech-status')).toHaveText('読み上げエラー');
    await expect(page.locator('#speech-toggle')).toBeEnabled();
    await expect(page.locator('#speech-toggle')).toHaveText('再生');
    await expect(page.locator('#speech-message')).toContainText(
      '読み上げに失敗しました（synthesis-failed）。このブラウザまたはOS環境では'
    );
  });

  test('plays long speech text as sequential chunks and ends after the last chunk', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.__speechCalls = [];
      const spokenUtterances: Array<SpeechSynthesisUtterance> = [];
      (
        window as unknown as { __spokenUtterances: Array<SpeechSynthesisUtterance> }
      ).__spokenUtterances = spokenUtterances;
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
        onstart: ((event: SpeechSynthesisEvent) => void) | null = null;
        onend: ((event: SpeechSynthesisEvent) => void) | null = null;
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
          speak: (utterance: SpeechSynthesisUtterance) => {
            spokenUtterances.push(utterance);
            window.__speechCalls.push({
              type: 'speak',
              text: utterance.text,
              textLength: utterance.text.length,
              rate: utterance.rate,
              voice: utterance.voice?.lang,
            });
            utterance.onstart?.(new Event('start') as SpeechSynthesisEvent);
          },
          pause: () => window.__speechCalls.push({ type: 'pause' }),
          resume: () => window.__speechCalls.push({ type: 'resume' }),
          cancel: () => window.__speechCalls.push({ type: 'cancel' }),
          getVoices: () => [mockVoice],
          addEventListener: () => undefined,
          pending: false,
          speaking: false,
          paused: false,
        } as unknown as SpeechSynthesis,
      });
    });

    await gotoAudioLearn(page);
    await page
      .locator('#audio-script-markdown h2', { hasText: '背景' })
      .locator('.audio-heading-play')
      .click();
    await expect(page.locator('#speech-status')).toHaveText('読み上げ中');
    await expect(page.locator('#speech-current-position')).toContainText('背景');

    let speakCalls = await page.evaluate(() =>
      window.__speechCalls.filter((call) => call.type === 'speak')
    );
    expect(speakCalls).toHaveLength(1);
    expect(speakCalls[0].textLength).toBeLessThanOrEqual(320);
    expect(speakCalls[0].rate).toBe(1);
    expect(speakCalls[0].voice).toBeUndefined();

    await page.locator('#speech-toggle').click();
    await expect(page.locator('#speech-status')).toHaveText('一時停止中');
    await page.locator('#speech-rate').selectOption('1.2');
    await expect(page.locator('#speech-status')).toHaveText('読み上げ中');
    speakCalls = await page.evaluate(() =>
      window.__speechCalls.filter((call) => call.type === 'speak')
    );
    expect(speakCalls).toHaveLength(2);
    expect(speakCalls[1].text).toBe(speakCalls[0].text);
    expect(speakCalls[1].rate).toBe(1.2);
    await expect(page.locator('#speech-message')).toBeHidden();
    await page.locator('#speech-toggle').click();
    await expect(page.locator('#speech-status')).toHaveText('一時停止中');
    await page.locator('#speech-toggle').click();
    await expect(page.locator('#speech-status')).toHaveText('読み上げ中');

    await page.evaluate(() => {
      const utterances = (
        window as unknown as {
          __spokenUtterances: Array<SpeechSynthesisUtterance>;
        }
      ).__spokenUtterances;
      utterances[utterances.length - 1].onend?.(new Event('end') as SpeechSynthesisEvent);
    });
    await expect
      .poll(() => page.evaluate(() => window.__speechCalls.filter((call) => call.type === 'speak')))
      .toHaveLength(3);

    speakCalls = await page.evaluate(() =>
      window.__speechCalls.filter((call) => call.type === 'speak')
    );
    expect(speakCalls[2].text).not.toContain('flowchart LR');
    expect(speakCalls[2].text).not.toContain('|');

    await page.evaluate(() => {
      const utterances = (
        window as unknown as {
          __spokenUtterances: Array<SpeechSynthesisUtterance>;
        }
      ).__spokenUtterances;
      while (utterances.length > 0) {
        const current = utterances[utterances.length - 1];
        const before = utterances.length;
        current.onend?.(new Event('end') as SpeechSynthesisEvent);
        if (utterances.length === before) break;
      }
    });
    await expect(page.locator('#speech-status')).toHaveText('読み上げ完了');
    await expect(page.locator('#speech-next')).toBeDisabled();
    await expect(page.locator('#speech-previous')).toBeEnabled();
    speakCalls = await page.evaluate(() =>
      window.__speechCalls.filter((call) => call.type === 'speak')
    );
    expect(speakCalls.length).toBeGreaterThan(1);
    expect(speakCalls.every((call) => !String(call.text).includes('flowchart LR'))).toBe(true);
    expect(speakCalls.every((call) => !String(call.text).includes('|'))).toBe(true);
  });

  test('resets speech UI when Chrome does not dispatch a start event', async ({ page }) => {
    await page.addInitScript(() => {
      window.__speechCalls = [];
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
        onstart: ((event: SpeechSynthesisEvent) => void) | null = null;
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
          speak: () => undefined,
          cancel: () => window.__speechCalls.push({ type: 'cancel' }),
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

    await expect(page.locator('#speech-status')).toHaveText('読み上げエラー', {
      timeout: 4000,
    });
    await expect(page.locator('#speech-toggle')).toBeEnabled();
    await expect(page.locator('#speech-toggle')).toHaveText('再生');
    await expect(page.locator('#speech-message')).toContainText('読み上げを開始できませんでした。');
    await expect
      .poll(() => page.evaluate(() => window.__speechCalls))
      .toEqual([{ type: 'cancel' }]);
  });

  test('shows retry guidance when watchdog sees speech synthesis is active', async ({ page }) => {
    await page.addInitScript(() => {
      window.__speechCalls = [];
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
        onstart: ((event: SpeechSynthesisEvent) => void) | null = null;
        onerror: ((event: SpeechSynthesisErrorEvent) => void) | null = null;

        constructor(text: string) {
          this.text = text;
        }
      }
      const speechSynthesisMock = {
        speak: () => {
          window.__speechCalls.push({ type: 'speak' });
          speechSynthesisMock.speaking = true;
        },
        cancel: () => window.__speechCalls.push({ type: 'cancel' }),
        getVoices: () => [mockVoice],
        addEventListener: () => undefined,
        pending: false,
        speaking: false,
        paused: false,
      };
      Object.defineProperty(window, 'SpeechSynthesisUtterance', {
        configurable: true,
        value: MockSpeechSynthesisUtterance,
      });
      Object.defineProperty(window, 'speechSynthesis', {
        configurable: true,
        value: speechSynthesisMock as unknown as SpeechSynthesis,
      });
    });

    await gotoAudioLearn(page);
    await page.locator('#speech-toggle').click();

    await expect(page.locator('#speech-status')).toHaveText('読み上げ確認中', {
      timeout: 4000,
    });
    await expect(page.locator('#speech-toggle')).toBeEnabled();
    await expect(page.locator('#speech-toggle')).toHaveText('再試行');
    await expect(page.locator('#speech-message')).toContainText(
      'ブラウザは読み上げ中と判定しています。音が出ない場合は「再試行」を押してください。'
    );
    await expect
      .poll(() => page.evaluate(() => window.__speechCalls))
      .toEqual([{ type: 'cancel' }, { type: 'speak' }]);

    await page.locator('#speech-toggle').click();
    await expect
      .poll(() => page.evaluate(() => window.__speechCalls))
      .toEqual([{ type: 'cancel' }, { type: 'speak' }, { type: 'cancel' }, { type: 'speak' }]);
  });

  test('does not surface interrupted errors from app queue reset', async ({ page }) => {
    await page.addInitScript(() => {
      window.__speechCalls = [];
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
        onstart: ((event: SpeechSynthesisEvent) => void) | null = null;
        onerror: ((event: SpeechSynthesisErrorEvent) => void) | null = null;

        constructor(text: string) {
          this.text = text;
          (
            window as unknown as { __currentUtterance: MockSpeechSynthesisUtterance }
          ).__currentUtterance = this;
        }
      }
      Object.defineProperty(window, 'SpeechSynthesisUtterance', {
        configurable: true,
        value: MockSpeechSynthesisUtterance,
      });
      Object.defineProperty(window, 'speechSynthesis', {
        configurable: true,
        value: {
          speak: (utterance: SpeechSynthesisUtterance) => {
            window.__speechCalls.push({ type: 'speak' });
            utterance.onstart?.(new Event('start') as SpeechSynthesisEvent);
          },
          cancel: () => {
            window.__speechCalls.push({ type: 'cancel' });
            (
              window as unknown as {
                __currentUtterance?: { onerror?: (event: SpeechSynthesisErrorEvent) => void };
              }
            ).__currentUtterance?.onerror?.({
              error: 'interrupted',
            } as SpeechSynthesisErrorEvent);
          },
          getVoices: () => [mockVoice],
          addEventListener: () => undefined,
          pending: false,
          speaking: true,
          paused: false,
        } as unknown as SpeechSynthesis,
      });
    });

    await gotoAudioLearn(page);
    await page.locator('#speech-toggle').click();

    await expect(page.locator('#speech-status')).toHaveText('読み上げ中');
    await expect(page.locator('#speech-message')).toBeHidden();
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
    await expect(page.locator('#speech-status')).toHaveText('利用不可');
    await expect(page.locator('#speech-message')).toContainText(
      'このブラウザでは読み上げ機能に対応していません。'
    );
  });
});

test.describe('[DEA][Data] Audio Learn quizzes', () => {
  test('uses the lightweight Audio Learn quiz schema', () => {
    expect(quizzes).toHaveLength(6);
    expect(quizzes.map((quiz: { id: string }) => quiz.id)).toEqual([
      'DEA-DAL-001',
      'DEA-DAL-002',
      'DEA-DAL-003',
      'DEA-DAL-004',
      'DEA-DAL-005',
      'DEA-DAL-006',
    ]);

    for (const chapter of chapters) {
      expect(
        quizzes.filter((quiz: { chapterId: string }) => quiz.chapterId === chapter.id)
      ).toHaveLength(3);
    }

    for (const quiz of quizzes) {
      expect(Object.keys(quiz.choices)).toEqual(['A', 'B', 'C', 'D']);
      expect(['A', 'B', 'C', 'D']).toContain(quiz.answer);
      expect(quiz.answerIndex).toBeUndefined();
      expect(quiz.whyWrong).toBeTruthy();
      expect(quiz.references.length).toBeGreaterThan(0);
      for (const excludedKey of ['domain', 'tags', 'difficulty', 'sourceType', 'notes']) {
        expect(quiz[excludedKey]).toBeUndefined();
      }
    }
  });
});
