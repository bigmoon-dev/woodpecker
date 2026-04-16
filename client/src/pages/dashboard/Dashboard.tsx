import { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Spin, theme } from 'antd';
import { Column, Pie, Area } from '@ant-design/charts';
import {
  BarChartOutlined,
  AlertOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import request from '../../utils/request';
import { useThemeTokens } from '../../themes/ThemeProvider';

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
  const { token: antToken } = theme.useToken();
  const themeTokens = useThemeTokens();

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
  const pendingAlerts = Number(overview?.pending_alerts || 0);

  const completionData = completion.flatMap((c) => [
    {
      label: `${c.grade_name} ${c.class_name}`,
      type: '已完成',
      value: Number(c.completed),
    },
    {
      label: `${c.grade_name} ${c.class_name}`,
      type: '未完成',
      value: Number(c.total_students) - Number(c.completed),
    },
  ]);

  const pieData = alertDist.map((a) => ({
    type: a.level === 'red' ? '红色预警' : '黄色预警',
    value: Number(a.count),
    level: a.level,
  }));

  const trendData = trend.flatMap((t) => [
    { date: String(t.date).slice(0, 10), type: '正常', value: Number(t.green) },
    {
      date: String(t.date).slice(0, 10),
      type: '黄色',
      value: Number(t.yellow),
    },
    { date: String(t.date).slice(0, 10), type: '红色', value: Number(t.red) },
  ]);

  const scaleData = scaleUsage.map((s) => ({
    name: s.scale_name,
    value: Number(s.answer_count),
  }));

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
              valueStyle={{ color: themeTokens.tokens.colorSuccess }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="红色预警"
              value={redAlerts}
              prefix={<AlertOutlined />}
              valueStyle={{ color: themeTokens.tokens.colorError }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待处理预警"
              value={pendingAlerts}
              prefix={<ExclamationCircleOutlined />}
              valueStyle={{ color: themeTokens.tokens.colorWarning }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={12}>
          <Card title="完成率（按班级）">
            <Column
              data={completionData}
              xField="label"
              yField="value"
              colorField="type"
              stack
              height={300}
              color={[
                themeTokens.tokens.colorSuccess,
                antToken.colorBorderSecondary,
              ]}
              legend={{ position: 'top-right' as const }}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="预警分布">
            <Pie
              data={pieData}
              angleField="value"
              colorField="type"
              height={300}
              color={(d: any) =>
                String((d as Record<string, unknown>).level) === 'red'
                  ? '#f5222d'
                  : '#faad14'
              }
              label={{ text: 'type', position: 'outside' as const }}
              legend={{ position: 'top-right' as const }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={12}>
          <Card title="趋势（近30天）">
            <Area
              data={trendData}
              xField="date"
              yField="value"
              colorField="type"
              stack
              height={300}
              legend={{ position: 'top-right' as const }}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="量表使用统计">
            <Column
              data={scaleData}
              xField="name"
              yField="value"
              height={300}
              label={{
                text: (d: any) => d.value,
                position: 'outside' as const,
              }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
