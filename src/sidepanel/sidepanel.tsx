import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Layout, Typography, Button, Input, Card, Space, Divider, message, theme } from 'antd';
import { SendOutlined, SyncOutlined, SettingOutlined } from '@ant-design/icons';
import './sidepanel.css';

const { Header, Content, Footer } = Layout;
const { Title, Text } = Typography;

interface SummaryState {
  loading: boolean;
  summarizing: boolean;
  error: string | null;
  chatHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  question: string;
}

const TONGYI_API_ENDPOINT = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';

const SidePanel: React.FC = () => {
  const { token } = theme.useToken();
  const [state, setState] = useState<SummaryState>({
    loading: false,
    summarizing: false,
    error: null,
    chatHistory: [],
    question: '',
  });

  const [pageContent, setPageContent] = useState<string | null>(null);

  const summarizeContent = async (content: string) => {
    // 先添加用户的总结请求消息
    setState(prev => ({
      ...prev,
      summarizing: true,
      error: null,
      chatHistory: [...prev.chatHistory, { role: 'user', content: '请总结这个页面的内容' }]
    }));

    try {
      const result = await chrome.storage.sync.get(['apiKey']);
      if (!result.apiKey) {
        setState(prev => ({
          ...prev,
          summarizing: false,
          error: '请先在扩展选项中设置通义千问 API key',
        }));
        return;
      }

      const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
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
                content: `你是一个网页内容总结助手。请将给定的网页内容总结为两部分：
1) 整体概述（200字以内）
2) 3-5个关键要点（每点30字以内）

请严格按照以下 JSON 格式输出，不要添加任何其他内容：
{
  "overview": "这里是整体概述",
  "keyPoints": ["这里是要点1", "这里是要点2", "这里是要点3"]
}`
              },
              {
                role: 'user',
                content: content,
              }
            ]
          }
        })
      });

      if (!response.ok) {
        throw new Error('请求失败: ' + response.statusText);
      }

      const data = await response.json();
      const text = data.output?.text;
      if (!text) {
        throw new Error('API 返回格式错误');
      }

      let summaryData;
      try {
        const cleanedText = text
          .replace(/\`\`\`json|\`\`\`|\n/g, '')
          .trim();
        summaryData = JSON.parse(cleanedText);
      } catch (e) {
        throw new Error('无法解析返回的 JSON 格式');
      }

      const { overview, keyPoints } = summaryData;
      if (!overview || !Array.isArray(keyPoints) || keyPoints.length === 0) {
        throw new Error('返回的数据格式不正确');
      }

      const summaryMessage = `**整体概述**\n${overview}\n\n**关键要点**\n${keyPoints.map((point: string) => `- ${point}`).join('\n')}`;
      
      setState(prev => ({
        ...prev,
        summarizing: false,
        chatHistory: [...prev.chatHistory, { role: 'assistant', content: summaryMessage }],
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        summarizing: false,
        error: error instanceof Error ? error.message : '发生错误',
      }));
    }
  };

  const askQuestion = async () => {
    if (!state.question.trim() || state.loading) return;

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
        chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_CONTENT' }, (response) => {
          if (response?.type === 'PAGE_CONTENT') {
            setPageContent(response.content);
          }
        });
      }
    });

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, []);

  return (
    <Layout style={{ height: '100vh', backgroundColor: 'white' }}>
      <Header style={{ 
        backgroundColor: 'white', 
        borderBottom: `1px solid ${token.colorBorder}`,
        padding: '0 16px',
        height: '48px',
        lineHeight: '48px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <Title level={4} style={{ margin: 0 }}>QuickSense</Title>
        <Button 
          icon={<SettingOutlined />} 
          type="text"
          onClick={() => chrome.runtime.openOptionsPage()}
        />
      </Header>

      <Content style={{ 
        padding: '16px', 
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        {state.error && (
          <Card
            style={{ backgroundColor: token.colorErrorBg }}
            bodyStyle={{ padding: '12px' }}
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text type="danger">{state.error}</Text>
              {state.error.includes('API key') && (
                <Button 
                  type="primary" 
                  danger
                  onClick={() => chrome.runtime.openOptionsPage()}
                >
                  打开设置
                </Button>
              )}
            </Space>
          </Card>
        )}

        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          overflowY: 'auto'
        }}>
          {state.chatHistory.map((message, index) => (
            <div
              key={index}
              style={{
                alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
              }}
            >
              <Card
                size="small"
                style={{
                  backgroundColor: message.role === 'user' ? token.colorPrimary : token.colorBgContainer,
                  borderColor: message.role === 'user' ? token.colorPrimary : token.colorBorder,
                }}
                bodyStyle={{ padding: '8px 12px' }}
              >
                <div
                  className="markdown-content"
                  style={{
                    color: message.role === 'user' ? 'white' : token.colorText,
                  }}
                >
                  <ReactMarkdown>{message.content}</ReactMarkdown>
                </div>
              </Card>
            </div>
          ))}
        </div>
      </Content>

      <Footer style={{ 
        padding: '16px',
        backgroundColor: 'white',
        borderTop: `1px solid ${token.colorBorder}`,
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <Button
          type="primary"
          icon={<SyncOutlined spin={state.summarizing} />}
          onClick={() => pageContent && summarizeContent(pageContent)}
          disabled={!pageContent || state.summarizing}
        >
          {state.summarizing ? '生成中...' : '总结页面'}
        </Button>

        <Space.Compact style={{ width: '100%' }}>
          <Input
            placeholder="输入问题..."
            value={state.question}
            onChange={(e) => setState(prev => ({ ...prev, question: e.target.value }))}
            onPressEnter={askQuestion}
            disabled={state.loading}
          />
          <Button
            type={state.loading ? 'default' : 'primary'}
            icon={state.loading ? <SyncOutlined spin /> : <SendOutlined />}
            onClick={askQuestion}
            disabled={!state.question.trim() || state.loading}
          >
            {state.loading ? '发送中...' : '发送'}
          </Button>
        </Space.Compact>
      </Footer>
    </Layout>
  );
};

export default SidePanel;
