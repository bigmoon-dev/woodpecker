import { useEffect, useState } from 'react';
import { Timeline, Tag, Empty, Card, Spin } from 'antd';
import { FileTextOutlined, FormOutlined, WarningOutlined } from '@ant-design/icons';
import { useParams } from 'react-router-dom';
import request from '../../utils/request';

interface TimelineEvent {
  id: string;
  date: string;
  eventType: 'interview' | 'assessment' | 'alert';
  summary: string;
}

const eventConfig: Record<string, { color: string; icon: React.ReactNode; label: string; tagColor: string }> = {
  interview: { color: 'blue', icon: <FileTextOutlined />, label: '访谈', tagColor: 'blue' },
  assessment: { color: 'green', icon: <FormOutlined />, label: '评估', tagColor: 'green' },
  alert: { color: 'red', icon: <WarningOutlined />, label: '预警', tagColor: 'red' },
};

interface TimelineViewProps {
  studentId?: string;
}

export default function TimelineView({ studentId: propStudentId }: TimelineViewProps) {
  const { studentId: paramStudentId } = useParams();
  const studentId = propStudentId || paramStudentId;

  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<TimelineEvent[]>([]);

  useEffect(() => {
    if (!studentId) return;
    setLoading(true);
    request
      .get(`/interviews/timeline/${studentId}`)
      .then((res: any) => {
        const list = res.data || res;
        setEvents(Array.isArray(list) ? list : []);
      })
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [studentId]);

  if (loading) return <Spin />;
  if (!studentId) return <Empty description="未指定学生" />;
  if (events.length === 0) return <Empty description="暂无时间线事件" />;

  return (
    <Card title="学生时间线">
      <Timeline
        items={events.map((event) => {
          const config = eventConfig[event.eventType] || eventConfig.interview;
          return {
            color: config.color,
            dot: config.icon,
            children: (
              <div>
                <div style={{ marginBottom: 4 }}>
                  <Tag color={config.tagColor}>{config.label}</Tag>
                  <span style={{ color: '#999', marginLeft: 8 }}>
                    {event.date ? new Date(event.date).toLocaleString() : '-'}
                  </span>
                </div>
                <div>{event.summary || '-'}</div>
              </div>
            ),
          };
        })}
      />
    </Card>
  );
}
