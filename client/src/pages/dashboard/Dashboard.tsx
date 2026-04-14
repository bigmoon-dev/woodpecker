import { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Spin } from 'antd';
import {
  BarChartOutlined,
  AlertOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import request from '../../utils/request';

interface OverviewData {
  total_tasks: string;
  total_answers: string;
  submitted_answers: string;
  total_alerts: string;
  red_alerts: string;
  yellow_alerts: string;
  pending_alerts: string;
}

interface CompletionItem {
  grade_name: string;
  class_name: string;
  total_students: string;
  completed: string;
}

interface AlertDistItem {
  level: string;
  count: string;
}

interface TrendItem {
  date: string;
  total: string;
  green: string;
  yellow: string;
  red: string;
}

interface ScaleUsageItem {
  scale_name: string;
  task_count: string;
  answer_count: string;
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [completion, setCompletion] = useState<CompletionItem[]>([]);
  const [alertDist, setAlertDist] = useState<AlertDistItem[]>([]);
  const [trend, setTrend] = useState<TrendItem[]>([]);
  const [scaleUsage, setScaleUsage] = useState<ScaleUsageItem[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [ov, comp, alert, tr, su]: any[] = await Promise.all([
          request.get('/dashboard/overview'),
          request.get('/dashboard/completion'),
          request.get('/dashboard/alert-distribution'),
          request.get('/dashboard/trend'),
          request.get('/dashboard/scale-usage'),
        ]);
        setOverview(ov);
        setCompletion(Array.isArray(comp) ? comp : []);
        setAlertDist(Array.isArray(alert) ? alert : []);
        setTrend(Array.isArray(tr) ? tr : []);
        setScaleUsage(Array.isArray(su) ? su : []);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    );
  }

  const submitted = Number(overview?.submitted_answers || 0);
  const total = Number(overview?.total_answers || 0);
  const rate = total > 0 ? Math.round((submitted / total) * 100) : 0;
  const redAlerts = Number(overview?.red_alerts || 0);
  const yellowAlerts = Number(overview?.yellow_alerts || 0);
  const pendingAlerts = Number(overview?.pending_alerts || 0);

  return (
    <div style={{ padding: 24 }}>
      <Row gutter={[16, 16]}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总任务数"
              value={overview?.total_tasks || 0}
              prefix={<BarChartOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="完成率"
              value={rate}
              suffix="%"
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="红色预警"
              value={redAlerts}
              prefix={<AlertOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待处理预警"
              value={pendingAlerts}
              prefix={<ExclamationCircleOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={12}>
          <Card title="完成率（按班级）">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: 8 }}>年级</th>
                  <th style={{ textAlign: 'left', padding: 8 }}>班级</th>
                  <th style={{ textAlign: 'right', padding: 8 }}>应完成</th>
                  <th style={{ textAlign: 'right', padding: 8 }}>已完成</th>
                  <th style={{ textAlign: 'right', padding: 8 }}>完成率</th>
                </tr>
              </thead>
              <tbody>
                {completion.map((c, i) => {
                  const totalS = Number(c.total_students);
                  const comp = Number(c.completed);
                  const pct = totalS > 0 ? Math.round((comp / totalS) * 100) : 0;
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: 8 }}>{c.grade_name}</td>
                      <td style={{ padding: 8 }}>{c.class_name}</td>
                      <td style={{ textAlign: 'right', padding: 8 }}>{totalS}</td>
                      <td style={{ textAlign: 'right', padding: 8 }}>{comp}</td>
                      <td style={{ textAlign: 'right', padding: 8 }}>{pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="预警分布">
            <div style={{ display: 'flex', justifyContent: 'space-around', padding: 24 }}>
              <Statistic title="红色预警" value={redAlerts} valueStyle={{ color: '#cf1322' }} />
              <Statistic title="黄色预警" value={yellowAlerts} valueStyle={{ color: '#faad14' }} />
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={12}>
          <Card title="趋势（近30天）">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: 8 }}>日期</th>
                  <th style={{ textAlign: 'right', padding: 8 }}>总计</th>
                  <th style={{ textAlign: 'right', padding: 8 }}>正常</th>
                  <th style={{ textAlign: 'right', padding: 8 }}>黄色</th>
                  <th style={{ textAlign: 'right', padding: 8 }}>红色</th>
                </tr>
              </thead>
              <tbody>
                {trend.slice(-14).map((t, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: 8 }}>{String(t.date).slice(0, 10)}</td>
                    <td style={{ textAlign: 'right', padding: 8 }}>{t.total}</td>
                    <td style={{ textAlign: 'right', padding: 8, color: '#52c41a' }}>{t.green}</td>
                    <td style={{ textAlign: 'right', padding: 8, color: '#faad14' }}>{t.yellow}</td>
                    <td style={{ textAlign: 'right', padding: 8, color: '#cf1322' }}>{t.red}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="量表使用统计">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: 8 }}>量表</th>
                  <th style={{ textAlign: 'right', padding: 8 }}>任务数</th>
                  <th style={{ textAlign: 'right', padding: 8 }}>完成数</th>
                </tr>
              </thead>
              <tbody>
                {scaleUsage.map((s, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: 8 }}>{s.scale_name}</td>
                    <td style={{ textAlign: 'right', padding: 8 }}>{s.task_count}</td>
                    <td style={{ textAlign: 'right', padding: 8 }}>{s.answer_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
