import { readFileSync } from 'node:fs';

import { test, expect, type Page } from '@playwright/test';

const chapters = JSON.parse(
  readFileSync(new URL('../../dea-audio-learn/data/chapters.json', import.meta.url), 'utf8')
);
const firstChapter = chapters[0];
const quizzes = JSON.parse(
  readFileSync(new URL('../../dea-audio-learn/data/quizzes.json', import.meta.url), 'utf8')
);
const appSource = readFileSync(new URL('../../dea-audio-learn/app.js', import.meta.url), 'utf8');

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
    await expect(page.getByRole('heading', { name: '領域を選ぶ' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'この領域のチャプター' })).toBeVisible();
    await expect(page.locator('#domain-list .domain-button')).toHaveText([
      'Databricks Intelligence Platform',
      'Data Ingestion and Loading',
      'Data Transformation and Modeling',
      'Working with Lakeflow Jobs',
      'Implementing CI/CD',
      'Troubleshooting, Monitoring, and Optimization',
      'Governance and Security',
    ]);
    await expect(page.locator('#domain-list .domain-button.is-active')).toHaveText(
      'Databricks Intelligence Platform'
    );
    await expect(page.locator('#chapter-list .chapter-button')).toHaveCount(2);
    await expect(page.locator('#chapter-list .chapter-button')).toContainText([
      'Chapter 1',
      'Chapter 2',
    ]);
    await expect(page.locator('#chapter-list .chapter-button').first()).not.toContainText(
      'Databricks Intelligence Platform'
    );
    const domainButtonHeights = await page
      .locator('#domain-list .domain-button')
      .evaluateAll((buttons) =>
        buttons.map((button) => Math.round(button.getBoundingClientRect().height))
      );
    expect(Math.max(...domainButtonHeights)).toBeLessThanOrEqual(52);
    const chapterButtonHeights = await page
      .locator('#chapter-list .chapter-button')
      .evaluateAll((buttons) =>
        buttons.map((button) => Math.round(button.getBoundingClientRect().height))
      );
    expect(Math.max(...chapterButtonHeights)).toBeLessThanOrEqual(58);
    await expect(page.getByRole('heading', { name: '音声教材', exact: true })).toBeVisible();
    await expect(page.locator('.summary-cue')).toBeVisible();
    await expect(page.getByRole('heading', { name: '読む教材' })).toHaveCount(0);
    await expect(page.locator('#content-markdown')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: '学習ステップ' })).toHaveCount(0);
    await expect(page.locator('.step-item')).toHaveCount(0);
    await expect(page.getByText('Phase 10で追加予定')).toHaveCount(0);
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
    const firstQuiz = page.locator('#mini-quiz-list .quiz-question').first();
    const firstQuizFeedback = firstQuiz.locator('.quiz-feedback');
    const firstQuizAnswerButton = firstQuiz.getByRole('button', { name: '回答する' });

    await firstQuiz.locator('input[type="radio"][value="D"]').check();
    await firstQuizAnswerButton.click();
    await expect(firstQuizFeedback).toContainText('不正解です。');
    await expect(firstQuizFeedback).toContainText(
      '正解は「取り込み、管理、分析、AI活用までをつなぐ統合基盤として見る」です。'
    );
    await expect(firstQuizFeedback).toContainText(
      '選んだ回答について：機械学習専用ではなく、データ活用全体を支えるプラットフォームです。'
    );
    await expect(firstQuizFeedback).toContainText(
      '解説：Databricks Intelligence Platformは、データの取り込みから管理、分析、AI活用までを統合的に扱う基盤として押さえることが重要です。'
    );
    await expect(firstQuizFeedback).not.toContainText(/正解は[A-D]/);
    await expect(firstQuizFeedback).not.toContainText(/選んだ[A-D]/);
    await expect(firstQuiz.locator('.quiz-references a').first()).toHaveAttribute(
      'target',
      '_blank'
    );
    await expect(firstQuiz.locator('.quiz-references a').first()).toHaveAttribute(
      'rel',
      'noopener noreferrer'
    );

    await firstQuiz.locator('input[type="radio"][value="B"]').check();
    await firstQuizAnswerButton.click();
    await expect(firstQuizFeedback).toContainText('正解です。');
    await expect(firstQuizFeedback).not.toContainText(/正解は[A-D]/);
    await expect(firstQuizFeedback).not.toContainText(/選んだ[A-D]/);
    await expect(page.locator('#note-markdown')).toContainText(
      'Databricks Intelligence Platformは'
    );
    await expect(page.locator('#note-markdown h1')).toHaveCount(0);
    await expect(page.locator('#note-markdown')).not.toContainText('Phase 6で追加予定');
    await expect(page.locator('#audio-script-markdown')).toContainText('はじめに');
    await expect(page.locator('#audio-script-markdown')).toContainText('本チャプターのゴール');
    await expect(page.locator('#audio-script-markdown')).toContainText('重要な考え方');
    await expect(page.locator('#audio-script-markdown')).not.toContainText('中心となる考え方');
    await expect(page.locator('#note-markdown')).toContainText('本チャプターのポイント');
    await expect(page.locator('#note-markdown')).toContainText('試験での注意点');
    await expect(page.locator('#note-markdown')).not.toContainText('試験で押さえるポイント');
    await expect(page.locator('#note-markdown')).not.toContainText('ひっかけ注意');
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
      (details as HTMLDetailsElement).open = false;
    });
    await expect(page.locator('.toc-speech-controls')).toBeVisible();
    await expect(page.locator('.toc-speech-controls')).not.toHaveCSS('display', 'none');
    const overviewActionsBox = await page.locator('.chapter-overview-actions').boundingBox();
    const minutesBox = await page.locator('#selected-minutes').boundingBox();
    const chapterNavBox = await page.locator('.chapter-nav').boundingBox();
    expect(overviewActionsBox).not.toBeNull();
    expect(minutesBox).not.toBeNull();
    expect(chapterNavBox).not.toBeNull();
    expect(Math.abs((minutesBox?.y ?? 0) - (chapterNavBox?.y ?? 0))).toBeLessThan(48);
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
    await expect(page.getByRole('heading', { name: '学習ステップ' })).toHaveCount(0);
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
    await expect(page.locator('#audio-script-markdown')).toContainText('重要な考え方');
    await expect(page.locator('#audio-script-markdown')).not.toContainText('中心となる考え方');
    await expect(page.locator('#note-markdown')).toContainText('本チャプターのポイント');
    await expect(page.locator('#note-markdown')).toContainText('試験での注意点');
    await expect(page.locator('#note-markdown')).not.toContainText('試験で押さえるポイント');
    await expect(page.locator('#note-markdown')).not.toContainText('ひっかけ注意');
    await expect(page.locator('#note-markdown h1')).toHaveCount(0);
    await expect(
      page.getByRole('heading', { name: 'データレイクだけでは困ること', level: 3 })
    ).toBeVisible();
    await expect(page.locator('#audio-toc-list')).toContainText(
      'Delta Lakeは信頼できるテーブル管理'
    );

    await page.getByRole('button', { name: 'Data Ingestion and Loading' }).click();
    await expect(page.locator('#selected-chapter-title')).toHaveText(
      'Data Ingestion and Loadingの全体像'
    );
    await expect(page.locator('#domain-list .domain-button.is-active')).toHaveText(
      'Data Ingestion and Loading'
    );
    await expect(page.locator('#chapter-list .chapter-button')).toHaveCount(1);
    await expect(page.locator('#chapter-list .chapter-button')).toContainText([
      'Chapter 3 Data Ingestion and Loadingの全体像',
    ]);
    await expect(page.locator('#chapter-list .chapter-button.is-active')).toContainText(
      'Data Ingestion and Loadingの全体像'
    );
    await expect(page.locator('#mini-quiz-list .quiz-question')).toHaveCount(3);
    await expect(page.locator('#mini-quiz-list')).toContainText(
      'Data Ingestion and Loadingで最初に押さえるべき観点'
    );
    await expect(page.locator('#note-markdown h1')).toHaveCount(0);
    await expect(page.locator('#note-markdown')).not.toContainText('要点メモ:');
    await expect(page.locator('#note-markdown a[id^="keyword-"]')).toHaveCount(12);
    await expect(page.locator('#note-markdown a[id^="keyword-"]').first()).not.toHaveAttribute(
      'href'
    );
    await expect(page.locator('#note-markdown a[href^="https://learn.microsoft.com"]')).toHaveCount(
      5
    );
    const autoLoaderInlineLink = page.locator(
      '#audio-script-markdown a[href="#keyword-auto-loader"]'
    );
    await expect(autoLoaderInlineLink).toHaveCount(1);
    await expect(autoLoaderInlineLink).not.toHaveAttribute('target', '_blank');
    await autoLoaderInlineLink.click();
    await expect(page).toHaveURL(/#keyword-auto-loader/u);
    await expect(page.locator('#note-markdown')).toContainText('Auto Loader');
    await expect(page.locator('#note-markdown')).toContainText(
      'クラウドストレージ上に継続到着するファイルを増分検出して取り込む仕組み。'
    );
    await expect(page.locator('#audio-script-markdown h3')).toHaveCount(6);
    await expect(page.locator('#audio-script-markdown')).toContainText(
      '以下の表は、取り込み方式を選ぶときに見る代表的な軸を整理したものです。'
    );
    await expect(page.locator('#audio-script-markdown')).toContainText(
      '以下は、landing領域からBronze、Silver、Goldへ進む基本的な流れです。'
    );
    await expect(page.locator('#audio-script-markdown')).toContainText(
      '以下は、JSONファイルを読み込み、Bronzeテーブルへ書き込む概念例です。'
    );
    await expect(page.locator('#audio-script-markdown')).toContainText('次の学習へのつなぎ');
    await expect(page.locator('#audio-script-markdown')).not.toContainText('次の学習へのつながり');
    await expect(page.locator('#audio-script-markdown pre code.language-mermaid')).toContainText(
      'flowchart LR'
    );
    await expect(page.locator('#audio-script-markdown pre code.language-python')).toContainText(
      'spark.readStream.format'
    );
    await expect(page.locator('#audio-toc-list')).toContainText(
      'クラウドストレージ上のファイルをBronzeへ取り込む'
    );
    await expect(page.locator('#speech-toggle')).toHaveText('再生');
    await expect(page.locator('#toc-speech-toggle')).toHaveText('再生');
    await page
      .locator('#audio-script-markdown h3', { hasText: 'Auto Loaderで継続取り込みする例' })
      .locator('.audio-heading-play')
      .click();
    await expect(page.locator('#speech-status')).toHaveText('読み上げ中');
    const latestIngestionSpeakCall = await page.evaluate(() => {
      const speakCalls = window.__speechCalls.filter((call) => call.type === 'speak');
      return speakCalls[speakCalls.length - 1];
    });
    expect(String(latestIngestionSpeakCall?.text)).not.toContain('flowchart LR');
    expect(String(latestIngestionSpeakCall?.text)).not.toContain('spark.readStream.format');

    await page.getByRole('button', { name: 'Data Transformation and Modeling' }).click();
    await expect(page.locator('#selected-chapter-title')).toHaveText(
      'Data Transformation and Modelingの全体像'
    );
    await expect(page.locator('#domain-list .domain-button.is-active')).toHaveText(
      'Data Transformation and Modeling'
    );
    await expect(page.locator('#chapter-list .chapter-button.is-active')).toContainText(
      'Data Transformation and Modelingの全体像'
    );
    await expect(page.locator('#mini-quiz-list .quiz-question')).toHaveCount(3);
    await expect(page.locator('#note-markdown h1')).toHaveCount(0);
    await expect(page.locator('#audio-script-markdown h3')).toHaveCount(6);
    await expect(page.locator('#audio-script-markdown')).toContainText('SoR');
    await expect(page.locator('#audio-script-markdown')).toContainText('SoI');
    await expect(page.locator('#audio-script-markdown')).toContainText('Bronze');
    await expect(page.locator('#audio-script-markdown')).toContainText('Silver');
    await expect(page.locator('#audio-script-markdown')).toContainText('Gold');
    await expect(page.locator('#audio-script-markdown pre code.language-mermaid')).toContainText(
      'daily_sales_summary'
    );
    await expect(page.locator('#audio-script-markdown pre code.language-python')).toContainText(
      'dropDuplicates'
    );
    await expect(page.locator('#audio-toc-list')).toContainText(
      'SoRからSoIへ、データの役割を変える'
    );
    await expect(page.locator('#speech-toggle')).toHaveText('再生');
    await page
      .locator('#audio-script-markdown h3', { hasText: 'SoRからSoIへ' })
      .locator('.audio-heading-play')
      .click();
    await expect(page.locator('#speech-status')).toHaveText('読み上げ中');
    const latestTransformSpeakCall = await page.evaluate(() => {
      const speakCalls = window.__speechCalls.filter((call) => call.type === 'speak');
      return speakCalls[speakCalls.length - 1];
    });
    expect(String(latestTransformSpeakCall?.text)).not.toContain('flowchart LR');
    expect(String(latestTransformSpeakCall?.text)).not.toContain('spark.table');
    expect(String(latestTransformSpeakCall?.text)).not.toContain('| 観点 |');

    await page.getByRole('button', { name: 'Working with Lakeflow Jobs' }).click();
    await expect(page.locator('#selected-chapter-title')).toHaveText(
      'Working with Lakeflow Jobsの全体像'
    );
    await expect(page.locator('#domain-list .domain-button.is-active')).toHaveText(
      'Working with Lakeflow Jobs'
    );
    await expect(page.locator('#chapter-list .chapter-button.is-active')).toContainText(
      'Working with Lakeflow Jobsの全体像'
    );
    await expect(page.locator('#mini-quiz-list .quiz-question')).toHaveCount(3);
    await expect(page.locator('#note-markdown h1')).toHaveCount(0);
    await expect(page.locator('#audio-script-markdown h3')).toHaveCount(7);
    await expect(page.locator('#audio-script-markdown')).toContainText('DAG');
    await expect(page.locator('#audio-script-markdown')).toContainText('retry');
    await expect(page.locator('#audio-script-markdown')).toContainText('trigger');
    await expect(page.locator('#audio-script-markdown')).toContainText('task dependency');
    await expect(page.locator('#audio-script-markdown pre code.language-mermaid')).toContainText(
      'Retry / Alert'
    );
    await expect(page.locator('#audio-script-markdown pre code.language-yaml')).toContainText(
      'daily_sales_pipeline'
    );
    await expect(page.locator('#audio-toc-list')).toContainText('DAGで依存関係を明示する');
    await expect(page.locator('#speech-toggle')).toHaveText('再生');
    await page
      .locator('#audio-script-markdown h3', { hasText: 'DAGで依存関係を明示する' })
      .locator('.audio-heading-play')
      .click();
    await expect(page.locator('#speech-status')).toHaveText('読み上げ中');
    const latestJobsSpeakCall = await page.evaluate(() => {
      const speakCalls = window.__speechCalls.filter((call) => call.type === 'speak');
      return speakCalls[speakCalls.length - 1];
    });
    expect(String(latestJobsSpeakCall?.text)).not.toContain('flowchart LR');
    expect(String(latestJobsSpeakCall?.text)).not.toContain('daily_sales_pipeline');
    expect(String(latestJobsSpeakCall?.text)).not.toContain('| 判断観点 |');

    await page.getByRole('button', { name: 'Implementing CI/CD' }).click();
    await expect(page.locator('#selected-chapter-title')).toHaveText('Implementing CI/CDの全体像');
    await expect(page.locator('#domain-list .domain-button.is-active')).toHaveText(
      'Implementing CI/CD'
    );
    await expect(page.locator('#chapter-list .chapter-button.is-active')).toContainText(
      'Implementing CI/CDの全体像'
    );
    await expect(page.locator('#mini-quiz-list .quiz-question')).toHaveCount(3);
    await expect(page.locator('#note-markdown h1')).toHaveCount(0);
    await expect(page.locator('#audio-script-markdown h3')).toHaveCount(8);
    await expect(page.locator('#audio-script-markdown')).toContainText(
      'データ基盤では「変更＝データの変化」'
    );
    await expect(page.locator('#audio-script-markdown')).toContainText('dev');
    await expect(page.locator('#audio-script-markdown')).toContainText('staging');
    await expect(page.locator('#audio-script-markdown')).toContainText('prod');
    await expect(page.locator('#audio-script-markdown')).toContainText('Databricks Asset Bundles');
    await expect(page.locator('#audio-script-markdown pre code.language-mermaid')).toContainText(
      'Lakeflow Jobs / Pipelines'
    );
    await expect(page.locator('#audio-script-markdown pre code.language-yaml')).toContainText(
      'etl_pipeline'
    );
    await expect(page.locator('#audio-toc-list')).toContainText(
      'データパイプラインもソフトウェアと同じくバージョン管理する'
    );
    await expect(page.locator('#speech-toggle')).toHaveText('再生');
    await page
      .locator('#audio-script-markdown h3', { hasText: 'データパイプラインもソフトウェア' })
      .locator('.audio-heading-play')
      .click();
    await expect(page.locator('#speech-status')).toHaveText('読み上げ中');
    const latestCicdSpeakCall = await page.evaluate(() => {
      const speakCalls = window.__speechCalls.filter((call) => call.type === 'speak');
      return speakCalls[speakCalls.length - 1];
    });
    expect(String(latestCicdSpeakCall?.text)).not.toContain('flowchart LR');
    expect(String(latestCicdSpeakCall?.text)).not.toContain('etl_pipeline');
    expect(String(latestCicdSpeakCall?.text)).not.toContain('| 観点 |');

    await page
      .getByRole('button', { name: 'Troubleshooting, Monitoring, and Optimization' })
      .click();
    await expect(page.locator('#selected-chapter-title')).toHaveText(
      'Troubleshooting, Monitoring, and Optimizationの全体像'
    );
    await expect(page.locator('#domain-list .domain-button.is-active')).toHaveText(
      'Troubleshooting, Monitoring, and Optimization'
    );
    await expect(page.locator('#chapter-list .chapter-button.is-active')).toContainText(
      'Troubleshooting, Monitoring, and Optimizationの全体像'
    );
    await expect(page.locator('#mini-quiz-list .quiz-question')).toHaveCount(3);
    await expect(page.locator('#note-markdown h1')).toHaveCount(0);
    await expect(page.locator('#audio-script-markdown h3')).toHaveCount(10);
    for (const keyword of [
      'run history',
      'DAG',
      'Spark UI',
      'data skew',
      'shuffle',
      'disk spilling',
      'OOM',
    ]) {
      await expect(page.locator('#audio-script-markdown')).toContainText(keyword);
    }
    await expect(page.locator('#audio-script-markdown pre code.language-mermaid')).toContainText(
      'Job run time increased'
    );
    await expect(page.locator('#audio-script-markdown pre code.language-python')).toContainText(
      'spark.sql.adaptive.enabled'
    );
    await expect(page.locator('#audio-toc-list')).toContainText(
      'Spark UIでは、ステージごとの偏りとデータ移動を見る'
    );
    await expect(page.locator('#speech-toggle')).toHaveText('再生');
    await page
      .locator('#audio-script-markdown h3', { hasText: 'Spark UIでは' })
      .locator('.audio-heading-play')
      .click();
    await expect(page.locator('#speech-status')).toHaveText('読み上げ中');
    const latestOpsSpeakCall = await page.evaluate(() => {
      const speakCalls = window.__speechCalls.filter((call) => call.type === 'speak');
      return speakCalls[speakCalls.length - 1];
    });
    expect(String(latestOpsSpeakCall?.text)).not.toContain('flowchart TD');
    expect(String(latestOpsSpeakCall?.text)).not.toContain('spark.sql.shuffle.partitions');
    expect(String(latestOpsSpeakCall?.text)).not.toContain('| 症状 |');

    await page.getByRole('button', { name: 'Governance and Security' }).click();
    await expect(page.locator('#selected-chapter-title')).toHaveText(
      'Governance and Securityの全体像'
    );
    await expect(page.locator('#domain-list .domain-button.is-active')).toHaveText(
      'Governance and Security'
    );
    await expect(page.locator('#chapter-list .chapter-button.is-active')).toContainText(
      'Governance and Securityの全体像'
    );
    await expect(page.locator('#mini-quiz-list .quiz-question')).toHaveCount(3);
    await expect(page.locator('#note-markdown h1')).toHaveCount(0);
    await expect(page.locator('#audio-script-markdown h3')).toHaveCount(10);
    for (const keyword of [
      'Unity Catalog',
      'managed table',
      'external table',
      'GRANT',
      'REVOKE',
      'DENY',
      'row-level security',
      'column masking',
      'ABAC',
    ]) {
      await expect(page.locator('#audio-script-markdown')).toContainText(keyword);
    }
    await expect(page.locator('#audio-script-markdown pre code.language-mermaid')).toContainText(
      'Audit / Policy / Access Control'
    );
    await expect(page.locator('#audio-script-markdown pre code.language-sql')).toContainText(
      'GRANT USE CATALOG'
    );
    await expect(page.locator('#audio-script-markdown pre code.language-sql')).toContainText(
      'mask_email'
    );
    await expect(page.locator('#audio-toc-list')).toContainText(
      'Unity Catalogは、データ資産を一元的に把握し統制する土台'
    );
    await expect(page.locator('#speech-toggle')).toHaveText('再生');
    await page
      .locator('#audio-script-markdown h3', { hasText: 'Unity Catalogは' })
      .locator('.audio-heading-play')
      .click();
    await expect(page.locator('#speech-status')).toHaveText('読み上げ中');
    const latestGovernanceSpeakCall = await page.evaluate(() => {
      const speakCalls = window.__speechCalls.filter((call) => call.type === 'speak');
      return speakCalls[speakCalls.length - 1];
    });
    expect(String(latestGovernanceSpeakCall?.text)).not.toContain('flowchart LR');
    expect(String(latestGovernanceSpeakCall?.text)).not.toContain('GRANT USE CATALOG');
    expect(String(latestGovernanceSpeakCall?.text)).not.toContain('| 観点 |');

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
    expect(chapters).toHaveLength(8);
    expect(new Set(chapters.map((chapter: { domain: string }) => chapter.domain))).toEqual(
      new Set([
        'Databricks Intelligence Platform',
        'Data Ingestion and Loading',
        'Data Transformation and Modeling',
        'Working with Lakeflow Jobs',
        'Implementing CI/CD',
        'Troubleshooting, Monitoring, and Optimization',
        'Governance and Security',
      ])
    );
    expect(quizzes).toHaveLength(24);
    expect(quizzes.map((quiz: { id: string }) => quiz.id)).toEqual(
      Array.from({ length: 24 }, (_, index) => `DEA-DAL-${String(index + 1).padStart(3, '0')}`)
    );

    for (const chapter of chapters) {
      expect(
        quizzes.filter((quiz: { chapterId: string }) => quiz.chapterId === chapter.id)
      ).toHaveLength(3);
    }

    const headingOrder = [
      '## 本チャプターのポイント',
      '## 試験での注意点',
      '## キーワード一覧',
      '## 参考リンク',
    ];
    const baseChapters = chapters.filter((chapter: { id: string }) =>
      ['dea-dip-001', 'dea-dip-002'].includes(chapter.id)
    );
    for (const chapter of baseChapters) {
      const audioScript = readFileSync(
        new URL(`../../dea-audio-learn/${chapter.audioScriptPath}`, import.meta.url),
        'utf8'
      );
      const note = readFileSync(
        new URL(`../../dea-audio-learn/${chapter.notePath}`, import.meta.url),
        'utf8'
      );
      expect(audioScript).not.toContain('## 中心となる考え方');
      expect(audioScript).toContain('## 重要な考え方');
      expect(note).toContain(`# 要点メモ: ${chapter.title}`);
      expect(note).not.toContain('## 試験で押さえるポイント');
      expect(note).not.toContain('## ひっかけ注意');
      const positions = headingOrder.map((heading) => note.indexOf(heading));
      expect(positions.every((position) => position >= 0)).toBe(true);
      expect(positions).toEqual([...positions].sort((a, b) => a - b));
    }

    const addedChapters = chapters.filter(
      (chapter: { id: string }) => !['dea-dip-001', 'dea-dip-002'].includes(chapter.id)
    );
    for (const chapter of addedChapters) {
      expect(chapter.audioScriptPath).toBe(`audio-scripts/${chapter.id}.md`);
      expect(chapter.notePath).toBe(`notes/${chapter.id}.md`);
      const audioScript = readFileSync(
        new URL(`../../dea-audio-learn/${chapter.audioScriptPath}`, import.meta.url),
        'utf8'
      );
      const note = readFileSync(
        new URL(`../../dea-audio-learn/${chapter.notePath}`, import.meta.url),
        'utf8'
      );
      expect(audioScript).toContain(`# 音声スクリプト: ${chapter.title}`);
      for (const heading of [
        '## はじめに',
        '## 本チャプターのゴール',
        '## 背景',
        '## 重要な考え方',
        '## 具体的なイメージ',
      ]) {
        expect(audioScript).toContain(heading);
      }
      if (chapter.id === 'dea-ingestion-001') {
        expect(audioScript).toContain('## 次の学習へのつなぎ');
        expect(audioScript).not.toContain('## 次の学習へのつながり');
        expect(audioScript.match(/^### /gm)?.length).toBeGreaterThanOrEqual(6);
        expect(audioScript).toContain('```mermaid');
        expect(audioScript).toContain('```python');
        expect(audioScript).toContain('spark.readStream.format("cloudFiles")');
        expect(audioScript).toContain('以下の表は、取り込み方式を選ぶときに見る代表的な軸');
        expect(audioScript).toContain(
          '以下は、landing領域からBronze、Silver、Goldへ進む基本的な流れ'
        );
        expect(audioScript).toContain(
          '以下は、JSONファイルを読み込み、Bronzeテーブルへ書き込む概念例'
        );
        expect(audioScript).toContain('schemaLocation');
        expect(audioScript).toContain('checkpointLocation');
        const boldPhrases = audioScript.match(/\*\*[^*]+\*\*/g) ?? [];
        expect(boldPhrases.length).toBeGreaterThanOrEqual(10);
        expect(boldPhrases.length).toBeLessThanOrEqual(18);
        expect(boldPhrases).toEqual(
          expect.arrayContaining([
            '**後続処理が安心して使える状態にすること**',
            '**データの性質と運用要件から選び分けること**',
            '**単発のファイル読み込みではなく、継続運用を前提にした取り込み**',
          ])
        );
        const nextSection = audioScript.split('## 次の学習へのつなぎ')[1] ?? '';
        expect(nextSection.split(/\n\n/u).filter((paragraph) => paragraph.trim()).length).toBe(2);
        for (const phrase of [
          'データが一度だけ届くのか、継続的に届くのか',
          'ファイル、データベース、SaaSなどどこから取り込むのか',
          'データ量や到着頻度',
          'スキーマ変化や品質確認',
          '再処理や監査の起点',
          'Data Transformation and Modeling',
        ]) {
          expect(nextSection).toContain(phrase);
        }
        expect(nextSection).not.toContain('Working with Lakeflow Jobs');
        expect(nextSection).not.toContain('Governance and Security');
        expect(audioScript).toContain('toTable');
        expect(audioScript).toContain('Data Transformation and Modeling');
        const keywordEntries = [
          `<a id="keyword-batch-loading"></a>**batch loading**\n  一定期間分のデータをまとめて取り込む方式。`,
          `<a id="keyword-streaming"></a>**streaming**\n  到着するデータを継続的に処理する方式。`,
          `<a id="keyword-incremental-loading"></a>**incremental loading**\n  前回処理後に追加・更新された分だけを取り込む方式。`,
          `<a id="keyword-copy-into"></a>**COPY INTO**\n  ファイルをDeltaテーブルへ繰り返し取り込むためのSQLベースの仕組み。`,
          `<a id="keyword-auto-loader"></a>**Auto Loader**\n  クラウドストレージ上に継続到着するファイルを増分検出して取り込む仕組み。`,
          `<a id="keyword-schema-enforcement"></a>**schema enforcement**\n  想定外のデータ構造を検知し、取り込み時の品質を守る考え方。`,
          `<a id="keyword-schema-evolution"></a>**schema evolution**\n  スキーマの変更を必要に応じて取り込めるようにする考え方。`,
          `<a id="keyword-lakeflow-connect"></a>**Lakeflow Connect**\n  SaaSやデータベースなどの外部システムから、管理された形でデータを取り込むための仕組み。`,
          `<a id="keyword-unity-catalog"></a>**Unity Catalog**\n  データ資産、権限、監査を統一的に管理する仕組み。`,
          `<a id="keyword-bronze"></a>**Bronze**\n  生データをできるだけ保持し、監査や再処理の起点とする層。`,
          `<a id="keyword-checkpoint-location"></a>**checkpointLocation**\n  ストリーミング処理で、どこまで処理済みかを記録する場所。`,
          `<a id="keyword-schema-location"></a>**schemaLocation**\n  Auto Loaderが検出したスキーマ情報を保存する場所。`,
        ];
        for (const keywordEntry of keywordEntries) {
          expect(note).toContain(keywordEntry);
        }
        expect(note).not.toContain('**Auto Loader**：');
        const keywordSection = note.split('## キーワード一覧')[1]?.split('## 参考リンク')[0] ?? '';
        expect(keywordSection).not.toContain('https://learn.microsoft.com');
        for (const anchor of [
          '#keyword-batch-loading',
          '#keyword-streaming',
          '#keyword-incremental-loading',
          '#keyword-copy-into',
          '#keyword-auto-loader',
          '#keyword-schema-enforcement',
          '#keyword-schema-evolution',
          '#keyword-lakeflow-connect',
          '#keyword-unity-catalog',
          '#keyword-bronze',
          '#keyword-checkpoint-location',
          '#keyword-schema-location',
        ]) {
          expect(audioScript).toContain(`](${anchor})`);
        }
        const referenceSection = note.split('## 参考リンク')[1] ?? '';
        const referenceLinks =
          referenceSection.match(
            /^- \[[^\]]+\]\(https:\/\/learn\.microsoft\.com\/ja-jp\/azure\/databricks\/[^)]+\)$/gm
          ) ?? [];
        expect(referenceLinks).toHaveLength(5);
      } else {
        expect(audioScript).toContain('## 次の学習へのつながり');
      }
      if (chapter.id === 'dea-transform-001') {
        expect(audioScript.match(/^### /gm)?.length).toBeGreaterThanOrEqual(6);
        expect(audioScript).toContain('SoR');
        expect(audioScript).toContain('SoI');
        expect(audioScript).toContain('Bronze');
        expect(audioScript).toContain('Silver');
        expect(audioScript).toContain('Gold');
        expect(audioScript).toContain('```mermaid');
        expect(audioScript).toContain('```python');
        expect(audioScript).toContain('dropDuplicates(["order_id"])');
      }
      if (chapter.id === 'dea-lakeflow-jobs-001') {
        expect(audioScript.match(/^### /gm)?.length).toBeGreaterThanOrEqual(7);
        expect(audioScript).toContain('DAG');
        expect(audioScript).toContain('retry');
        expect(audioScript).toContain('trigger');
        expect(audioScript).toContain('task dependency');
        expect(audioScript).toContain('```mermaid');
        expect(audioScript).toContain('```yaml');
        expect(audioScript).toContain('daily_sales_pipeline');
      }
      if (chapter.id === 'dea-cicd-001') {
        expect(audioScript.match(/^### /gm)?.length).toBeGreaterThanOrEqual(8);
        expect(audioScript).toContain('データ基盤では「変更＝データの変化」である');
        expect(audioScript).toContain('dev');
        expect(audioScript).toContain('staging');
        expect(audioScript).toContain('prod');
        expect(audioScript).toContain('Databricks Asset Bundles');
        expect(audioScript).toContain('```mermaid');
        expect(audioScript).toContain('```yaml');
        expect(audioScript).toContain('etl_pipeline');
      }
      if (chapter.id === 'dea-ops-001') {
        expect(audioScript.match(/^### /gm)?.length).toBeGreaterThanOrEqual(10);
        for (const keyword of [
          'run history',
          'DAG',
          'Spark UI',
          'data skew',
          'shuffle',
          'disk spilling',
          'OOM',
        ]) {
          expect(audioScript).toContain(keyword);
        }
        expect(audioScript).toContain('```mermaid');
        expect(audioScript).toContain('```python');
        expect(audioScript).toContain('spark.sql.adaptive.enabled');
      }
      if (chapter.id === 'dea-governance-001') {
        expect(audioScript.match(/^### /gm)?.length).toBeGreaterThanOrEqual(10);
        for (const keyword of [
          'Unity Catalog',
          'managed table',
          'external table',
          'GRANT / REVOKE / DENY',
          'row-level security',
          'column masking',
          'ABAC',
        ]) {
          expect(audioScript).toContain(keyword);
        }
        expect(audioScript).toContain('```mermaid');
        expect(audioScript).toContain('```sql');
        expect(audioScript).toContain('mask_email');
      }
      expect(note).toContain(`# 要点メモ: ${chapter.title}`);
      for (const heading of [
        '## 本チャプターのポイント',
        '## 試験での注意点',
        '## キーワード一覧',
        '## 参考リンク',
      ]) {
        expect(note).toContain(heading);
      }
      expect(note).not.toContain('ミニクイズ前の確認');
    }

    expect(appSource).not.toContain('getDisplayExplanation');
    expect(appSource).not.toMatch(/replace\(\/\^正解は\[A-D\]です。/u);

    for (const quiz of quizzes) {
      expect(Object.keys(quiz.choices)).toEqual(['A', 'B', 'C', 'D']);
      expect(['A', 'B', 'C', 'D']).toContain(quiz.answer);
      expect(quiz.answerIndex).toBeUndefined();
      expect(quiz.explanation).not.toMatch(/^正解は[A-D]です。/u);
      expect(quiz.whyWrong).toBeTruthy();
      expect(quiz.references.length).toBeGreaterThan(0);
      for (const excludedKey of ['domain', 'tags', 'difficulty', 'sourceType', 'notes']) {
        expect(quiz[excludedKey]).toBeUndefined();
      }
    }
  });
});
