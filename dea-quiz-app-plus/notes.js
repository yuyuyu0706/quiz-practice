// Phase 0 ではメモ機能を実装しない。
// 参考元アプリと同じモジュール分割構成を保つため、学習進捗の初期値だけを提供する。
export function baseProgress() {
  return {
    seenCount: 0,
    correctCount: 0,
    wrongCount: 0,
    lastAnsweredAt: null,
    bookmark: false,
  };
}
