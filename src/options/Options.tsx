import React, { useEffect, useState } from 'react';

const Options: React.FC = () => {
  const [apiKey, setApiKey] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    // 加载保存的 API key
    chrome.storage.sync.get(['apiKey'], (result) => {
      if (result.apiKey) {
        setApiKey(result.apiKey);
      }
    });
  }, []);

  const handleSave = () => {
    chrome.storage.sync.set(
      { apiKey },
      () => {
        setStatus('API key 已保存');
        setTimeout(() => setStatus(''), 2000);
      }
    );
  };

  return (
    <div className="options-container">
      <h1>QuickSense 设置</h1>
      <div className="option-group">
        <label htmlFor="apiKey">通义千问 API Key:</label>
        <input
          type="password"
          id="apiKey"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="输入你的 API key"
        />
        <button onClick={handleSave}>保存</button>
      </div>
      {status && <div className="status-message">{status}</div>}
    </div>
  );
};

export default Options;
