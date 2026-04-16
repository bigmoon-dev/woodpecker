import { Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { PrivateRoute, setToken, setRoles } from './utils/auth';
import { routeConfigs } from './router';
import { ThemeProvider, useTheme } from './themes/ThemeProvider';
import { themes } from './themes';

function ThemedApp() {
  const { themeKey } = useTheme();
  const theme = themes[themeKey];

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: theme.tokens.colorPrimary,
          colorBgContainer: theme.tokens.colorBgContainer,
          colorBgLayout: theme.tokens.colorBgLayout,
          colorText: theme.tokens.colorText,
          colorTextSecondary: theme.tokens.colorTextSecondary,
          colorBorder: theme.tokens.colorBorder,
          colorBorderSecondary: theme.tokens.colorBorderSecondary,
          colorSuccess: theme.tokens.colorSuccess,
          colorWarning: theme.tokens.colorWarning,
          colorError: theme.tokens.colorError,
          colorInfo: theme.tokens.colorInfo,
          borderRadius: theme.tokens.borderRadius,
          fontFamily: theme.tokens.fontFamily,
        },
        components: {
          Button: {
            primaryShadow: `0 2px 8px ${theme.tokens.colorPrimary}40`,
          },
          Card: {
            boxShadowTertiary: '0 1px 4px rgba(0,0,0,0.06)',
          },
          Table: {
            headerBg: theme.tokens.colorBgLayout,
            rowHoverBg: `${theme.tokens.colorPrimary}08`,
          },
          Menu: {
            itemSelectedBg: `${theme.tokens.colorPrimary}15`,
            itemSelectedColor: '#fff',
            itemHoverBg: `${theme.tokens.colorPrimary}10`,
          },
        },
      }}
    >
      <Routes>
        {routeConfigs.map((config) => {
          if (config.public) {
            const Component = config.component!;
            return (
              <Route
                key={config.path}
                path={config.path}
                element={<Component />}
              />
            );
          }
          const Layout = config.layout!;
          return (
            <Route
              key={config.path}
              path={`${config.path}/*`}
              element={
                <PrivateRoute>
                  <Layout />
                </PrivateRoute>
              }
            >
              <Route index element={<Navigate to={config.children![0].path} replace />} />
              {config.children!.map((child) => {
                const ChildComponent = child.component;
                return (
                  <Route
                    key={child.path}
                    path={child.path}
                    element={<ChildComponent />}
                  />
                );
              })}
            </Route>
          );
        })}
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </ConfigProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ThemedApp />
    </ThemeProvider>
  );
}
