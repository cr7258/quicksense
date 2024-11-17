// 监听扩展安装或更新事件
chrome.runtime.onInstalled.addListener((details) => {
  // 只在首次安装时打开选项页面
  if (details.reason === 'install') {
    chrome.runtime.openOptionsPage();
  }
  
  // 初始化侧边栏
  chrome.sidePanel.setOptions({
    enabled: true,
    path: 'sidepanel.html'
  });
});

// 监听扩展图标点击事件
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    // 如果是点击扩展图标，打开侧边栏
    chrome.sidePanel.setOptions({
      enabled: true,
      path: 'sidepanel.html'
    });
  }
});

// 监听快捷键命令
chrome.commands.onCommand.addListener((command) => {
  if (command === "open_options") {
    chrome.runtime.openOptionsPage();
  }
});
