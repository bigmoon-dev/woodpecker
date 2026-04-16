import { useState } from 'react';
import { Form, Input, Button, Card, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import request from '../utils/request';
import { setToken, setRoles } from '../utils/auth';
import { useThemeTokens } from '../themes/ThemeProvider';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const themeTokens = useThemeTokens();

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      const res: any = await request.post('/auth/login', values);
      setToken(res.accessToken);
      const payload = JSON.parse(atob(res.accessToken.split('.')[1]));
      setRoles(payload.roles || []);
      const roles = payload.roles || [];
      if (roles.includes('admin')) navigate('/admin');
      else if (roles.includes('teacher')) navigate('/teacher');
      else navigate('/student');
    } catch {
      message.error('登录失败，请检查用户名和密码');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: themeTokens.loginBg,
        transition: 'background 0.5s ease',
      }}
    >
      <Card
        title="心理健康量表系统 — 登录"
        style={{
          width: 400,
          borderRadius: themeTokens.tokens.borderRadius * 2,
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          backdropFilter: 'blur(8px)',
          background: 'rgba(255,255,255,0.95)',
        }}
      >
        <Form onFinish={onFinish} layout="vertical">
          <Form.Item name="username" label="用户名" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              登录
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
