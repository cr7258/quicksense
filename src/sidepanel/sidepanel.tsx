import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import './sidepanel.css';

interface SummaryState {
  loading: boolean;
  error: string | null;
  summary: {
    overview: string | null;
    keyPoints: string[] | null;
  };
  question: string;
  chatHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

const TONGYI_API_ENDPOINT = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';

const SidePanel: React.FC = () => {
  const [state, setState] = useState<SummaryState>({
    loading: false,
    error: null,
    summary: {
      overview: null,
      keyPoints: null,
    },
    question: '',
    chatHistory: [],
  });

  const [pageContent, setPageContent] = useState<string | null>(null);

  const summarizeContent = async (content: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
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
                content: '你是一个帮助总结网页内容的助手。请提供两部分内容：\n1. 整体概述（200字以内的摘要）\n2. 关键要点（3-5个要点，每个要点都应该简洁明了）\n\n请使用 Markdown 格式输出，使用 ## 作为标题，使用 - 作为列表项。'
              },
              {
                role: 'user',
                content: `请帮我总结以下内容：\n${content}`
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
      const summaryText = data.output?.text || '';
      
      // 解析总结内容
      const overviewMatch = summaryText.match(/##\s*整体概述\s*([\s\S]*?)(?=##|$)/i);
      const keyPointsMatch = summaryText.match(/##\s*关键要点\s*([\s\S]*?)$/i);
      
      const overview = overviewMatch ? overviewMatch[1].trim() : summaryText;
      const keyPointsText = keyPointsMatch ? keyPointsMatch[1].trim() : '';
      const keyPoints = keyPointsText
        .split(/[-*]\s+/)
        .map((point: string) => point.trim())
        .filter((point: string) => point.length > 0);

      setState(prev => ({
        ...prev,
        loading: false,
        summary: {
          overview,
          keyPoints,
        },
        error: null
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : '发生错误',
        summary: {
          overview: null,
          keyPoints: null,
        }
      }));
    }
  };

  const askQuestion = async () => {
    if (!state.question.trim() || !pageContent) return;

    setState(prev => ({
      ...prev,
      loading: true,
      chatHistory: [...prev.chatHistory, { role: 'user', content: state.question }],
      question: '',
    }));

    try {
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
                content: '你是一个帮助回答问题的助手。请使用 Markdown 格式回答问题，合理使用标题、列表、粗体、斜体等格式。'
              },
              {
                role: 'user',
                content: `Context: ${pageContent}\n\nQuestion: ${state.question}`
              }
            ]
          }
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || '获取回答失败');
      }

      const data = await response.json();
      setState(prev => ({
        ...prev,
        loading: false,
        error: null,
        chatHistory: [...prev.chatHistory, { role: 'assistant', content: data.output?.text || '无法生成回答' }],
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : '发生错误',
      }));
    }
  };

  useEffect(() => {
    const messageListener = (message: any) => {
      if (message.type === 'PAGE_CONTENT') {
        setPageContent(message.content);
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
      <h2>QuickSense</h2>
      
      <div className="action-button">
        <button 
          onClick={() => pageContent && summarizeContent(pageContent)}
          disabled={!pageContent || state.loading}
        >
          {state.loading ? '生成中...' : '总结页面'}
        </button>
      </div>

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

      {state.summary.overview && (
        <div className="summary">
          <h3>整体概述</h3>
          <div className="markdown-content">
            <ReactMarkdown>{state.summary.overview}</ReactMarkdown>
          </div>
          
          {state.summary.keyPoints && state.summary.keyPoints.length > 0 && (
            <>
              <h3>关键要点</h3>
              <div className="markdown-content">
                <ReactMarkdown>
                  {state.summary.keyPoints.map((point: string) => `- ${point}\n`).join('')}
                </ReactMarkdown>
              </div>
            </>
          )}
        </div>
      )}

      <div className="chat-section">
        <h3>问答</h3>
        <div className="chat-history">
          {state.chatHistory.map((message, index) => (
            <div key={index} className={`chat-message ${message.role}`}>
              <div className="message-content markdown-content">
                <ReactMarkdown>{message.content}</ReactMarkdown>
              </div>
            </div>
          ))}
        </div>
        <div className="chat-input">
          <input
            type="text"
            value={state.question}
            onChange={(e) => setState(prev => ({ ...prev, question: e.target.value }))}
            onKeyPress={(e) => e.key === 'Enter' && askQuestion()}
            placeholder="输入问题..."
            disabled={state.loading}
          />
          <button 
            onClick={askQuestion}
            disabled={!state.question.trim() || state.loading}
          >
            发送
          </button>
        </div>
      </div>
    </div>
  );
};

export default SidePanel;
