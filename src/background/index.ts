// 监听扩展安装事件
chrome.runtime.onInstalled.addListener((details) => {
  // 只在首次安装时打开选项页面
  if (details.reason === 'install') {
    chrome.runtime.openOptionsPage();
  }
});

// 监听来自content script的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'openSidePanel' && sender.tab?.windowId) {
    chrome.sidePanel.open({ windowId: sender.tab.windowId })
      .catch(error => {
        console.error('Error opening side panel:', error);
      });
  }
});

// 监听扩展图标点击事件
chrome.action.onClicked.addListener(async (tab) => {
  if (tab?.id) {
    try {
      // 通知 content script 处理内容
      await chrome.tabs.sendMessage(tab.id, { action: 'simulateButtonClick' });
    } catch (error) {
      console.error('Error handling action click:', error);
    }
  }
});

// 监听快捷键命令
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "toggle_side_panel") {
    try {
      // 获取当前标签页
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        // 向 content script 发送消息
        await chrome.tabs.sendMessage(tab.id, { action: 'simulateButtonClick' });
      }
    } catch (error) {
      console.error('Error handling keyboard shortcut:', error);
    }
  } else if (command === "open_options") {
    chrome.runtime.openOptionsPage();
  }
});
