import { PianoPracticeApp } from './app/PianoPracticeApp.js';

console.log('=== INDEX.JS LOADED ===');

// 最もシンプルなテスト
document.addEventListener('DOMContentLoaded', () => {
  console.log('=== DOM CONTENT LOADED ===');
  
  // 直接ボタンにイベントリスナーを追加してテスト
  const testBtn = document.getElementById('connectMidiBtn');
  if (testBtn) {
    console.log('=== BUTTON FOUND ===');
    testBtn.addEventListener('click', () => {
      console.log('=== DIRECT BUTTON CLICK ===');
      alert('ボタンがクリックされました！');
    });
  } else {
    console.error('=== BUTTON NOT FOUND ===');
  }
  
  // アプリケーションの初期化
  const app = new PianoPracticeApp();
  app.initialize();
});

// エラーハンドリング
window.addEventListener('error', (event) => {
  console.error('Application error:', event.error);
  showErrorMessage('アプリケーションエラーが発生しました。ページを再読み込みしてください。');
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  showErrorMessage('予期しないエラーが発生しました。');
});

function showErrorMessage(message: string): void {
  const errorElement = document.getElementById('errorMessage');
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    setTimeout(() => {
      errorElement.style.display = 'none';
    }, 5000);
  }
}