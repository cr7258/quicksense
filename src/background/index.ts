// 监听扩展安装事件
chrome.runtime.onInstalled.addListener((details) => {
  // 只在首次安装时打开选项页面
  if (details.reason === 'install') {
    chrome.runtime.openOptionsPage();
  }
});

// 存储side panel的状态
let sidePanelOpen = false;

// 切换side panel的状态
async function toggleSidePanel(windowId: number) {
  try {
    if (!sidePanelOpen) {
      // 如果side panel关闭，则打开它
      await chrome.sidePanel.open({ windowId });
      sidePanelOpen = true;
    } else {
      // 如果side panel打开，则关闭它
      await chrome.sidePanel.close({ windowId });
      sidePanelOpen = false;
    }
  } catch (error) {
    console.error('Error toggling side panel:', error);
    // 如果出错，重置状态
    sidePanelOpen = false;
  }
}

// 监听扩展图标点击事件
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id) {
    await toggleSidePanel(tab.windowId);
  }
});

// 监听来自content script的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'toggleSidePanel') {
    // 获取当前窗口ID
    const windowId = sender.tab?.windowId;
    if (windowId) {
      // 切换side panel状态
      toggleSidePanel(windowId)
        .then(() => {
          sendResponse({ success: true });
        })
        .catch((error: Error) => {
          console.error('Error toggling side panel:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true; // 保持消息通道开启
    }
  }
});

// 监听快捷键命令
chrome.commands.onCommand.addListener((command) => {
  if (command === "open_options") {
    chrome.runtime.openOptionsPage();
  }
});
