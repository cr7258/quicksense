import React, { useEffect, useState } from 'react';

interface SummaryState {
  loading: boolean;
  error: string | null;
  summary: string | null;
}

const TONGYI_API_ENDPOINT = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';

const SidePanel: React.FC = () => {
  const [state, setState] = useState<SummaryState>({
    loading: false,
    error: null,
    summary: null,
  });

  const summarizeContent = async (content: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // 获取 API key
      const result = await chrome.storage.sync.get(['apiKey']);
      if (!result.apiKey) {
        setState(prev => ({
          ...prev,
          loading: false,
          error: '请先在扩展选项中设置通义千问 API key',
        }));
        return;
      }

      const response = await fetch(TONGYI_API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${result.apiKey}`,
        },
        body: JSON.stringify({
          model: 'qwen-turbo',
          input: {
            messages: [
              {
                role: 'system',
                content: 'You are a helpful assistant that summarizes web content.'
              },
              {
                role: 'user',
                content: `Please provide a concise summary of the following content:\n${content}`
              }
            ]
          }
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || '获取摘要失败');
      }

      const data = await response.json();
      setState(prev => ({
        ...prev,
        loading: false,
        summary: data.output?.text || '未生成摘要',
        error: null
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : '发生错误',
        summary: null
      }));
    }
  };

  useEffect(() => {
    const messageListener = (message: any) => {
      if (message.type === 'PAGE_CONTENT') {
        summarizeContent(message.content);
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);

    // 初始化时请求页面内容
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_CONTENT' });
      }
    });

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, []);

  return (
    <div className="side-panel">
      <h2>页面摘要</h2>
      
      {state.loading && <div className="loading">正在生成摘要...</div>}
      {state.error && (
        <div className="error">
          {state.error}
          {state.error.includes('API key') && (
            <div className="error-action">
              <button onClick={() => chrome.runtime.openOptionsPage()}>
                打开设置
              </button>
            </div>
          )}
        </div>
      )}
      {state.summary && (
        <div className="summary">
          <p>{state.summary}</p>
        </div>
      )}
    </div>
  );
};

export default SidePanel;
