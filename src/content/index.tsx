import React from 'react';
import { createRoot } from 'react-dom/client';
import styled from 'styled-components';

// Function to extract main content from the page
const extractPageContent = (): string => {
  // Get the main content (prioritize article or main content)
  const article = document.querySelector('article');
  const main = document.querySelector('main');
  const body = document.body;

  let content = '';

  if (article) {
    content = article.textContent || '';
  } else if (main) {
    content = main.textContent || '';
  } else {
    // If no article or main tag, try to get content from body
    // excluding common navigation and footer elements
    const elements = Array.from(body.getElementsByTagName('*'));
    const contentElements = elements.filter(element => {
      const tag = element.tagName.toLowerCase();
      const role = element.getAttribute('role');
      return !['nav', 'header', 'footer', 'aside'].includes(tag) &&
             !['navigation', 'banner', 'contentinfo'].includes(role || '');
    });
    content = contentElements.map(el => el.textContent).join('\n');
  }

  // Clean up the content
  return content.replace(/\s+/g, ' ').trim();
};

// 悬浮按钮样式
const FloatingButton = styled.button`
  position: fixed;
  right: 20px;
  bottom: 20px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: #1890ff;
  color: white;
  border: none;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: all 0.3s;
  z-index: 10000;
  overflow: hidden;

  &:hover {
    background-color: #40a9ff;
    transform: scale(1.05);
  }

  img {
    width: 40px;
    height: 40px;
    object-fit: cover;
  }
`;

// 主应用组件
const App: React.FC = () => {
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  const handleContentExtraction = async () => {
    try {
      const content = extractPageContent();
      // 保存内容到本地存储
      await chrome.storage.local.set({ pageContent: content });
      // 直接在当前窗口打开 side panel
      await chrome.runtime.sendMessage({ action: 'openSidePanel' });
    } catch (error) {
      console.error('Error handling content:', error);
    }
  };

  // 监听来自 background script 的消息
  React.useEffect(() => {
    const messageListener = async (message: any) => {
      if (message.action === 'simulateButtonClick') {
        await handleContentExtraction();
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, []);

  return (
    <FloatingButton ref={buttonRef} onClick={handleContentExtraction}>
      <img src={chrome.runtime.getURL('icon.png')} alt="QuickSense" onError={(e) => {
        const target = e.target as HTMLImageElement;
        target.style.display = 'none';
        target.parentElement!.textContent = '+';
      }} />
    </FloatingButton>
  );
};

// 创建并插入应用容器
const init = () => {
  // 检查当前页面是否是扩展页面
  if (window.location.protocol === 'chrome-extension:') {
    return; // 如果是扩展页面，不注入悬浮按钮
  }

  const container = document.createElement('div');
  container.id = 'quicksense-container';
  document.body.appendChild(container);

  const root = createRoot(container);
  root.render(<App />);
};

// 在页面加载完成后初始化
init();

// Listen for messages from the sidebar
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_CONTENT') {
    const content = extractPageContent();
    // 直接使用 sendResponse 回复消息
    sendResponse({
      type: 'PAGE_CONTENT',
      content,
    });
    return true; // 表示我们会异步发送响应
  }
});
