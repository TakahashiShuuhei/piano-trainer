import { PianoPracticeApp } from './app/PianoPracticeApp.js';

// アプリケーションの初期化
document.addEventListener('DOMContentLoaded', () => {
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