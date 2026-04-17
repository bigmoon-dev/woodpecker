import { useState, useEffect } from 'react';
import { Input, Button, Space, Empty, Spin, message } from 'antd';
import request from '../../utils/request';

interface OcrEditorProps {
  interviewId: string;
  ocrText: string | null;
  onSave: (text: string) => void;
}

export default function OcrEditor({ interviewId, ocrText, onSave }: OcrEditorProps) {
  const [text, setText] = useState(ocrText || '');
  const [saving, setSaving] = useState(false);
  const [reOcring, setReOcring] = useState(false);

  useEffect(() => {
    setText(ocrText || '');
  }, [ocrText]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await request.put(`/interviews/${interviewId}`, { ocrText: text });
      message.success('保存成功');
      onSave(text);
    } catch {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleReOcr = async () => {
    setReOcring(true);
    try {
      const res: any = await request.get(`/interviews/${interviewId}/files`);
      const files = res.data || res;
      if (Array.isArray(files) && files.length > 0) {
        await Promise.all(
          files.map((f: any) => request.post(`/interviews/${interviewId}/files/${f.id}/ocr`)),
        );
        message.success('已触发重新OCR，请稍后刷新');
      } else {
        message.warning('没有可OCR的文件');
      }
    } catch {
      message.error('重新OCR失败');
    } finally {
      setReOcring(false);
    }
  };

  if (!ocrText) {
    return (
      <Empty description="暂无OCR文本">
        <Button type="primary" loading={reOcring} onClick={handleReOcr}>
          重新OCR
        </Button>
      </Empty>
    );
  }

  return (
    <Spin spinning={reOcring}>
      <Input.TextArea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={12}
        style={{ marginBottom: 12 }}
        placeholder="OCR识别文本"
      />
      <Space>
        <Button type="primary" loading={saving} onClick={handleSave}>
          保存
        </Button>
        <Button loading={reOcring} onClick={handleReOcr}>
          重新OCR
        </Button>
      </Space>
    </Spin>
  );
}
