import { useState, useEffect } from 'react';
import { Card, Spin } from 'antd';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const MANUAL_URL = '/docs/用户使用说明书.md';

export default function HelpPage() {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(MANUAL_URL)
      .then((res) => (res.ok ? res.text() : '# 加载失败\n\n未能加载用户使用说明书。'))
      .then(setContent)
      .catch(() => setContent('# 加载失败\n\n未能加载用户使用说明书。'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  return (
    <Card
      style={{ margin: 0, borderRadius: 8 }}
      styles={{ body: { padding: '24px 32px' } }}
    >
      <div style={{ lineHeight: 1.8, fontSize: 14, color: 'rgba(0,0,0,0.85)', maxWidth: 860 }}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    </Card>
  );
}
