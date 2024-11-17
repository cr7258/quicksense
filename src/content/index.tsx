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
