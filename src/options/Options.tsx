import React, { useEffect, useState } from 'react';

const Options: React.FC = () => {
  const [tongyiApiKey, setTongyiApiKey] = useState('');
  const [claudeApiKey, setClaudeApiKey] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    // 加载保存的 API keys
    chrome.storage.sync.get(['tongyiApiKey', 'claudeApiKey'], (result) => {
      if (result.tongyiApiKey) {
        setTongyiApiKey(result.tongyiApiKey);
      }
      if (result.claudeApiKey) {
        setClaudeApiKey(result.claudeApiKey);
      }
    });
  }, []);

  const handleSave = () => {
    chrome.storage.sync.set(
      { 
        tongyiApiKey,
        claudeApiKey
      },
      () => {
        setStatus('API keys 已保存');
        setTimeout(() => setStatus(''), 2000);
      }
    );
  };

  return (
    <div className="options-container">
      <h1>QuickSense 设置</h1>
      <div className="option-group">
        <label htmlFor="tongyiApiKey">通义千问 API Key:</label>
        <input
          type="password"
          id="tongyiApiKey"
          value={tongyiApiKey}
          onChange={(e) => setTongyiApiKey(e.target.value)}
          placeholder="输入你的通义千问 API key"
        />
      </div>
      <div className="option-group">
        <label htmlFor="claudeApiKey">Claude API Key:</label>
        <input
          type="password"
          id="claudeApiKey"
          value={claudeApiKey}
          onChange={(e) => setClaudeApiKey(e.target.value)}
          placeholder="输入你的 Claude API key"
        />
      </div>
      <button onClick={handleSave}>保存</button>
      {status && <div className="status-message">{status}</div>}
    </div>
  );
};

export default Options;
