import { useState, useEffect } from 'react';
import { Form, Input, Button, Collapse, Empty, Spin, message, Space, Alert } from 'antd';
import request from '../../utils/request';

interface SummaryViewProps {
  interviewId: string;
  ocrText: string | null;
  structuredSummary: Record<string, string> | null;
  templateFields?: { key: string; label: string }[];
  onReload?: () => void;
}

export default function SummaryView({ interviewId, ocrText, structuredSummary, templateFields, onReload }: SummaryViewProps) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);

  useEffect(() => {
    if (structuredSummary) {
      form.setFieldsValue(structuredSummary);
    }
  }, [structuredSummary, form]);

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

  const handleSave = async () => {
    setSaving(true);
    try {
      const values = await form.validateFields();
      await request.put(`/interviews/${interviewId}`, {
        structuredSummary: values,
      });
      message.success('保存成功');
      onReload?.();
    } catch {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const fields = templateFields && templateFields.length > 0
    ? templateFields
    : structuredSummary
      ? Object.keys(structuredSummary).map((key) => ({ key, label: key }))
      : [];

  if (!structuredSummary && !ocrText) {
    return (
      <Empty description="暂无摘要数据，请先上传文件并等待OCR完成">
        <Button type="primary" loading={extracting} onClick={handleExtract}>
          手动提取摘要
        </Button>
      </Empty>
    );
  }

  return (
    <Spin spinning={extracting}>
      {!structuredSummary && ocrText && (
        <Alert
          type="info"
          message="OCR已完成，摘要提取中..."
          description="系统正在自动从OCR文本中提取结构化摘要，请稍后刷新查看。如果长时间未生成，可以手动点击提取。"
          showIcon
          style={{ marginBottom: 16 }}
          action={
            <Button size="small" loading={extracting} onClick={handleExtract}>
              手动提取
            </Button>
          }
        />
      )}

      {fields.length > 0 && (
        <Form form={form} layout="vertical" onFinish={handleSave}>
          {fields.map((field) => (
            <Form.Item
              key={field.key}
              name={field.key}
              label={field.label}
            >
              <Input.TextArea rows={2} placeholder={`请输入${field.label}`} />
            </Form.Item>
          ))}
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={saving}>
                保存摘要
              </Button>
              <Button loading={extracting} onClick={handleExtract}>
                重新提取
              </Button>
            </Space>
          </Form.Item>
        </Form>
      )}

      {ocrText && (
        <Collapse
          style={{ marginTop: 16 }}
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
