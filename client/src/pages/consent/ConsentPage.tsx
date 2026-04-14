import { useState } from 'react';
import { Card, Form, Input, Button, Checkbox, message } from 'antd';
import request from '../../utils/request';

export default function ConsentPage() {
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const onFinish = async (values: any) => {
    if (!agreed) return message.warning('请先同意知情同意书');
    setLoading(true);
    try {
      const token = localStorage.getItem('token') || '';
      const payload = JSON.parse(atob(token.split('.')[1]));
      await request.post('/consent', {
        userId: payload.sub,
        consentType: 'assessment',
        content: values.content || '',
        signedAt: new Date().toISOString(),
      });
      message.success('签署成功');
    } catch {
      message.error('签署失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="知情同意书">
      <div style={{ marginBottom: 16, padding: 16, background: '#f5f5f5', borderRadius: 8 }}>
        <p>尊敬的用户：</p>
        <p>在开始心理健康测评之前，请您仔细阅读以下知情同意书。本次测评结果仅用于心理健康评估，您的个人信息将被严格保密。</p>
        <p>参与测评完全自愿，您有权随时退出。</p>
      </div>
      <Form layout="vertical" onFinish={onFinish}>
        <Form.Item>
          <Checkbox checked={agreed} onChange={(e) => setAgreed(e.target.checked)}>
            我已阅读并同意上述知情同意书
          </Checkbox>
        </Form.Item>
        <Form.Item name="content" label="补充说明（可选）">
          <Input.TextArea rows={3} />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} disabled={!agreed}>
            签署同意
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
}
