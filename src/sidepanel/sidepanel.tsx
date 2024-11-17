import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Layout, Typography, Button, Input, Card, Space, Divider, message, theme, Select } from 'antd';
import { SendOutlined, SyncOutlined, SettingOutlined } from '@ant-design/icons';
import './sidepanel.css';

const { Header, Content, Footer } = Layout;
const { Title, Text } = Typography;

interface SummaryState {
  loading: boolean;
  summarizing: boolean;
  error: null | string;
  chatHistory: Array<{ role: string; content: string }>;
  question: string;
}

const TONGYI_API_ENDPOINT = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
const CLAUDE_API_ENDPOINT = 'https://api.anthropic.com/v1/messages';

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
  const [selectedModel, setSelectedModel] = useState<'tongyi' | 'claude'>('tongyi');

  useEffect(() => {
    // 从存储中加载选择的模型
    chrome.storage.sync.get(['selectedModel'], (result) => {
      if (result.selectedModel) {
        setSelectedModel(result.selectedModel);
      }
    });
  }, []);

  const handleModelChange = (value: 'tongyi' | 'claude') => {
    setSelectedModel(value);
    chrome.storage.sync.set({ selectedModel: value });
  };

  const callAI = async (messages: Array<{ role: string; content: string }>) => {
    const result = await chrome.storage.sync.get([
      'tongyiApiKey',
      'claudeApiKey',
      'selectedModel'
    ]);

    const apiKey = selectedModel === 'tongyi' ? result.tongyiApiKey : result.claudeApiKey;
    if (!apiKey) {
      throw new Error(`请先在扩展选项中设置${selectedModel === 'tongyi' ? '通义千问' : 'Claude'} API key`);
    }

    if (selectedModel === 'tongyi') {
      const response = await fetch(TONGYI_API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'qwen-turbo',
          input: { messages }
        }),
      });

      if (!response.ok) {
        throw new Error('请求失败: ' + response.statusText);
      }

      const data = await response.json();
      return data.output?.text;
    } else {
      const response = await fetch(CLAUDE_API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          'x-api-key': apiKey,
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-3-opus-20240229',
          max_tokens: 4096,
          messages: messages.map(msg => ({
            role: msg.role === 'system' ? 'assistant' : msg.role,
            content: msg.content
          })),
          temperature: 0.7
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error('请求失败: ' + (errorData?.error?.message || response.statusText));
      }

      const data = await response.json();
      return data.content[0].text;
    }
  };

  const summarizeContent = async (content: string) => {
    // 先添加用户的总结请求消息
    setState(prev => ({
      ...prev,
      summarizing: true,
      error: null,
      chatHistory: [...prev.chatHistory, { role: 'user', content: '请总结这个页面的内容' }]
    }));

    try {
      const response = await callAI([
        {
          role: 'system',
          content: `你是一个专业的文档分析和总结专家。请将给定的网页内容总结为以下几个部分：

1. 全文摘要（300字以内）：
   - 用简洁专业的语言概括文档的主要内容
   - 突出核心功能和重要概念
   - 说明文档的目标读者和应用场景

2. 关键段落（不限字数）：
   - 使用 markdown 格式的列表
   - 每个要点使用加粗的小标题
   - 详细展开每个要点的具体内容
   - 保留技术细节和专业术语
   - 突出限制条件和注意事项

请按照以下 JSON 格式输出，确保内容的完整性和专业性：
{
  "summary": "这里是全文摘要",
  "keyPoints": [
    {
      "title": "这里是要点标题",
      "content": "这里是要点详细内容"
    }
  ]
}`
        },
        {
          role: 'user',
          content: content,
        }
      ]);

      if (!response) {
        throw new Error('无法生成总结');
      }

      let summaryData;
      try {
        const cleanedText = response
          .replace(/\`\`\`json|\`\`\`|\n/g, '')
          .trim();
        summaryData = JSON.parse(cleanedText);
      } catch (e) {
        throw new Error('无法解析返回的 JSON 格式');
      }

      const { summary, keyPoints } = summaryData;
      if (!summary || !Array.isArray(keyPoints) || keyPoints.length === 0) {
        throw new Error('返回的数据格式不正确');
      }

      const summaryMessage = `**全文摘要**\n${summary}\n\n**关键段落**\n${keyPoints.map(point => 
        `- **${point.title}**\n  ${point.content}`
      ).join('\n\n')}`;
      
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
      const response = await callAI([
        {
          role: 'system',
          content: '你是一个帮助回答问题的助手。请使用 Markdown 格式回答问题，合理使用标题、列表、粗体、斜体等格式。'
        },
        {
          role: 'user',
          content: `Context: ${pageContent}\n\nQuestion: ${state.question}`
        }
      ]);

      if (!response) {
        throw new Error('无法生成回答');
      }

      setState(prev => ({
        ...prev,
        loading: false,
        error: null,
        chatHistory: [...prev.chatHistory, { role: 'assistant', content: response }],
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
    <Layout style={{ height: '100vh', backgroundColor: token.colorBgContainer }}>
      <Header style={{ 
        padding: '0 16px', 
        backgroundColor: token.colorBgContainer,
        borderBottom: `1px solid ${token.colorBorder}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <Title level={4} style={{ margin: 0 }}>QuickSense</Title>
        <Space>
          <Select
            value={selectedModel}
            onChange={handleModelChange}
            style={{ width: 120 }}
            options={[
              { value: 'tongyi', label: '通义千问' },
              { value: 'claude', label: 'Claude' }
            ]}
          />
          <Button 
            icon={<SettingOutlined />} 
            type="text"
            onClick={() => chrome.runtime.openOptionsPage()}
          />
        </Space>
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
        backgroundColor: token.colorBgContainer,
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
