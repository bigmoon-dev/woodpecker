import { useState } from 'react';
import { Form, Input, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import request from '../utils/request';
import { setToken, setRoles, parseJwtPayload } from '../utils/auth';
import { useThemeTokens } from '../themes/ThemeProvider';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const t = useThemeTokens();

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      const res: any = await request.post('/auth/login', values);
      setToken(res.accessToken);
      const payload = parseJwtPayload(res.accessToken);
      setRoles(payload.roles || []);
      const roles = payload.roles || [];
      if (roles.includes('admin')) navigate('/admin');
      else if (roles.includes('psychologist') || roles.includes('teacher'))
        navigate('/teacher');
      else navigate('/student');
    } catch (err: any) {
      console.error('Login error:', err);
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        '登录失败，请检查用户名和密码';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <style>{`
        @keyframes loginFloat1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(30px, -40px) scale(1.1); }
        }
        @keyframes loginFloat2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-20px, 30px) scale(1.15); }
        }
        @keyframes loginFloat3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(15px, 20px) scale(1.05); }
        }
        @keyframes loginFadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .login-brand { animation: loginFadeIn 0.8s ease-out; }
        .login-form-card { animation: loginFadeIn 0.8s ease-out 0.2s both; }
        .login-btn:hover { transform: scale(1.02); }
        .login-btn:active { transform: scale(0.98); }
      `}</style>

      <div
        className="login-brand"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: t.loginBg,
          position: 'relative',
          overflow: 'hidden',
          padding: 48,
        }}
      >
        <div
          style={{
            position: 'absolute',
            width: 300,
            height: 300,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.08)',
            top: '10%',
            left: '5%',
            animation: 'loginFloat1 8s ease-in-out infinite',
          }}
        />
        <div
          style={{
            position: 'absolute',
            width: 200,
            height: 200,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.06)',
            bottom: '15%',
            right: '10%',
            animation: 'loginFloat2 10s ease-in-out infinite',
          }}
        />
        <div
          style={{
            position: 'absolute',
            width: 150,
            height: 150,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.1)',
            top: '50%',
            left: '60%',
            animation: 'loginFloat3 12s ease-in-out infinite',
          }}
        />

        <div
          style={{
            position: 'relative',
            zIndex: 1,
            textAlign: 'center',
            color: '#fff',
          }}
        >
          <div style={{ fontSize: 64, marginBottom: 24 }}>🪶</div>
          <h1
            style={{
              fontSize: 32,
              fontWeight: 700,
              margin: 0,
              textShadow: '0 2px 8px rgba(0,0,0,0.2)',
            }}
          >
            啄木鸟
          </h1>
          <p
            style={{
              fontSize: 18,
              opacity: 0.9,
              marginTop: 12,
              letterSpacing: 2,
            }}
          >
            心理健康预警辅助系统
          </p>
          <p style={{ fontSize: 14, opacity: 0.7, marginTop: 8 }}>
            {t.psychologyNote}
          </p>
        </div>
      </div>

      <div
        style={{
          width: 480,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 48,
          background: t.tokens.colorBgContainer,
        }}
      >
        <div
          className="login-form-card"
          style={{ width: '100%', maxWidth: 360 }}
        >
          <h2
            style={{
              fontSize: 24,
              fontWeight: 600,
              marginBottom: 8,
              color: t.tokens.colorText,
            }}
          >
            欢迎登录
          </h2>
          <p
            style={{
              fontSize: 14,
              marginBottom: 32,
              color: t.tokens.colorTextSecondary,
            }}
          >
            请输入您的账号信息
          </p>

          <Form onFinish={onFinish} layout="vertical" size="large">
            <Form.Item
              name="username"
              rules={[{ required: true, message: '请输入用户名' }]}
            >
              <Input
                prefix={
                  <UserOutlined
                    style={{ color: t.tokens.colorTextSecondary }}
                  />
                }
                placeholder="用户名"
                style={{ borderRadius: t.tokens.borderRadius }}
              />
            </Form.Item>
            <Form.Item
              name="password"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password
                prefix={
                  <LockOutlined
                    style={{ color: t.tokens.colorTextSecondary }}
                  />
                }
                placeholder="密码"
                style={{ borderRadius: t.tokens.borderRadius }}
              />
            </Form.Item>
            <Form.Item style={{ marginBottom: 0 }}>
              <button
                type="submit"
                className="login-btn"
                disabled={loading}
                style={{
                  width: '100%',
                  height: 44,
                  border: 'none',
                  borderRadius: t.tokens.borderRadius,
                  background: `linear-gradient(135deg, ${t.tokens.colorPrimary}, ${t.tokens.colorPrimary}dd)`,
                  color: '#fff',
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                  transition: 'transform 0.2s ease, opacity 0.2s ease',
                  letterSpacing: 4,
                }}
              >
                {loading ? '登录中...' : '登 录'}
              </button>
            </Form.Item>
          </Form>
        </div>
      </div>
    </div>
  );
}
