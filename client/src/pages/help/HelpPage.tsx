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
      <div
        className="help-content"
        style={{
          lineHeight: 1.8,
          fontSize: 14,
          color: 'rgba(0,0,0,0.85)',
          maxWidth: 860,
        }}
      >
        <style
          dangerouslySetInnerHTML={{
            __html: `
              .help-content table { width: 100%; border-collapse: collapse; margin: 12px 0 20px; font-size: 13px; }
              .help-content table th { background: #fafafa; font-weight: 600; text-align: left; padding: 8px 12px; border: 1px solid #f0f0f0; }
              .help-content table td { padding: 8px 12px; border: 1px solid #f0f0f0; }
              .help-content table tr:hover td { background: #fafafa; }
              .help-content h1 { font-size: 22px; margin: 0 0 16px; }
              .help-content h2 { font-size: 18px; margin: 24px 0 12px; border-bottom: 1px solid #f0f0f0; padding-bottom: 8px; }
              .help-content h3 { font-size: 16px; margin: 20px 0 8px; }
              .help-content h4 { font-size: 14px; margin: 16px 0 8px; }
              .help-content ul, .help-content ol { padding-left: 20px; margin: 8px 0; }
              .help-content li { margin: 4px 0; }
              .help-content blockquote { border-left: 3px solid #1677ff; margin: 12px 0; padding: 4px 16px; color: rgba(0,0,0,0.45); }
              .help-content code { background: #f5f5f5; padding: 2px 6px; border-radius: 3px; font-size: 13px; }
              .help-content pre { background: #f5f5f5; padding: 12px 16px; border-radius: 6px; overflow-x: auto; }
              .help-content pre code { background: none; padding: 0; }
              .help-content a { color: #1677ff; }
            `,
          }}
        />
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    </Card>
  );
}
