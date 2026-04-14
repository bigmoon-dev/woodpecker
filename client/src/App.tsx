import { Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { PrivateRoute } from './utils/auth';
import { routeConfigs } from './router';

export default function App() {
  return (
    <ConfigProvider locale={zhCN}>
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
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </ConfigProvider>
  );
}
