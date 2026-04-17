import { useState } from 'react';
import { Descriptions, Button, Collapse, Empty, Spin, message } from 'antd';
import request from '../../utils/request';

interface SummaryViewProps {
  interviewId: string;
  ocrText: string | null;
  structuredSummary: Record<string, string> | null;
  onReload?: () => void;
}

export default function SummaryView({ interviewId, ocrText, structuredSummary, onReload }: SummaryViewProps) {
  const [extracting, setExtracting] = useState(false);

  const handleExtract = async () => {
    setExtracting(true);
    try {
      await request.post(`/interviews/${interviewId}/extract-summary`);
      message.success('摘要提取成功');
      onReload?.();
    } catch {
      message.error('摘要提取失败');
    } finally {
      setExtracting(false);
    }
  };

  if (!structuredSummary && !ocrText) {
    return (
      <Empty description="暂无摘要数据">
        <Button type="primary" loading={extracting} onClick={handleExtract}>
          提取摘要
        </Button>
      </Empty>
    );
  }

  return (
    <Spin spinning={extracting}>
      {!structuredSummary && (
        <Button type="primary" loading={extracting} onClick={handleExtract} style={{ marginBottom: 16 }}>
          提取摘要
        </Button>
      )}

      {structuredSummary && (
        <Descriptions bordered column={1} style={{ marginBottom: 16 }}>
          {Object.entries(structuredSummary).map(([key, value]) => (
            <Descriptions.Item key={key} label={key}>{value}</Descriptions.Item>
          ))}
        </Descriptions>
      )}

      {ocrText && (
        <Collapse
          items={[
            {
              key: 'ocr',
              label: '原始OCR文本',
              children: (
                <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 400, overflow: 'auto' }}>
                  {ocrText}
                </pre>
              ),
            },
          ]}
        />
      )}
    </Spin>
  );
}
