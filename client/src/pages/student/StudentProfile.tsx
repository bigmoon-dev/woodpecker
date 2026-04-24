import { useEffect, useState } from 'react';
import {
  Card,
  Descriptions,
  Tag,
  Spin,
  message,
  Row,
  Col,
  Timeline,
  Button,
  Table,
  Empty,
} from 'antd';
import {
  ArrowLeftOutlined,
  UserOutlined,
  AlertOutlined,
  FileTextOutlined,
  MedicineBoxOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import request from '../../utils/request';

interface StudentInfo {
  id: string;
  name: string;
  gradeName: string;
  className: string;
  gender: string | null;
}

interface AlertItem {
  id: string;
  level: string;
  status: string;
  createdAt: string;
  handlingHistory: { action: string; note: string; createdAt: string }[];
}

interface AssessmentItem {
  id: string;
  color: string;
  createdAt: string;
  answerId: string;
}

interface InterviewItem {
  id: string;
  type: string;
  status: string;
  createdAt: string;
  notes: string;
}

interface RiskSuggestion {
  suggestedLevel: string;
  basedOnResultId: string;
  previousLevel: string;
}

interface StudentProfileData {
  student: StudentInfo;
  currentRiskLevel: string | null;
  lastAssessmentDate: string | null;
  assessmentHistory: AssessmentItem[];
  interviewHistory: InterviewItem[];
  alertHistory: AlertItem[];
  pendingFollowups: any[];
  riskLevelSuggestion: RiskSuggestion | null;
}

const levelMap: Record<string, { color: string; text: string }> = {
  red: { color: 'red', text: '红色预警' },
  yellow: { color: 'gold', text: '黄色预警' },
  green: { color: 'green', text: '正常' },
};

const statusMap: Record<string, { color: string; text: string }> = {
  pending: { color: 'default', text: '待处理' },
  handled: { color: 'blue', text: '已处理' },
  followup: { color: 'orange', text: '已随访' },
};

const interviewStatusMap: Record<string, { color: string; text: string }> = {
  draft: { color: 'blue', text: '草稿' },
  reviewed: { color: 'orange', text: '已审阅' },
  completed: { color: 'green', text: '已完成' },
};

export default function StudentProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = location.pathname.startsWith('/admin') ? '/admin' : '/teacher';
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<StudentProfileData | null>(null);

  useEffect(() => {
    if (!id) return;
    async function load() {
      setLoading(true);
      try {
        const res: any = await request.get(`/students/${id}/profile`);
        setProfile(res);
      } catch {
        message.error('加载学生档案失败');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Empty description="未找到学生档案" />
        <Button
          style={{ marginTop: 16 }}
          onClick={() => navigate(`${basePath}/interviews/followup-manage`)}
        >
          返回随访管理
        </Button>
      </div>
    );
  }

  const riskInfo = levelMap[profile.currentRiskLevel || ''] || {
    color: 'default',
    text: '未评估',
  };

  const timelineEvents = [
    ...profile.alertHistory.map((a) => ({
      type: 'alert' as const,
      date: a.createdAt,
      data: a,
    })),
    ...profile.assessmentHistory.map((a) => ({
      type: 'assessment' as const,
      date: a.createdAt,
      data: a,
    })),
    ...profile.interviewHistory.map((i) => ({
      type: 'interview' as const,
      date: i.createdAt,
      data: i,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div style={{ padding: 24 }}>
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate(-1)}
        style={{ marginBottom: 16 }}
      >
        返回
      </Button>

      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card
            title={
              <span>
                <UserOutlined style={{ marginRight: 8 }} />
                学生信息
              </span>
            }
          >
            <Descriptions column={4}>
              <Descriptions.Item label="姓名">
                {profile.student.name || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="年级">
                {profile.student.gradeName}
              </Descriptions.Item>
              <Descriptions.Item label="班级">
                {profile.student.className}
              </Descriptions.Item>
              <Descriptions.Item label="性别">
                {profile.student.gender || '-'}
              </Descriptions.Item>
            </Descriptions>
            <div style={{ marginTop: 8 }}>
              <span style={{ marginRight: 16 }}>
                当前风险等级：
                <Tag color={riskInfo.color} style={{ marginLeft: 4 }}>
                  {riskInfo.text}
                </Tag>
              </span>
              {profile.lastAssessmentDate && (
                <span>
                  最近测评：
                  {new Date(profile.lastAssessmentDate).toLocaleDateString(
                    'zh-CN',
                  )}
                </span>
              )}
              {profile.riskLevelSuggestion && (
                <Tag
                  color="blue"
                  style={{ marginLeft: 16 }}
                  icon={<AlertOutlined />}
                >
                  建议调整：{levelMap[profile.riskLevelSuggestion.suggestedLevel]?.text || profile.riskLevelSuggestion.suggestedLevel}
                </Tag>
              )}
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={14}>
          <Card
            title={
              <span>
                <FileTextOutlined style={{ marginRight: 8 }} />
                事件时间线
              </span>
            }
          >
            {timelineEvents.length === 0 ? (
              <Empty description="暂无记录" />
            ) : (
              <Timeline
                items={timelineEvents.slice(0, 20).map((evt) => {
                  const date = new Date(evt.date).toLocaleString('zh-CN');
                  if (evt.type === 'alert') {
                    const a = evt.data as AlertItem;
                    const lv = levelMap[a.level] || {
                      color: 'default',
                      text: a.level,
                    };
                    const st = statusMap[a.status] || {
                      color: 'default',
                      text: a.status,
                    };
                    return {
                      color: lv.color === 'red' ? 'red' : lv.color === 'gold' ? 'gold' : 'green',
                      children: (
                        <div>
                          <div>
                            <AlertOutlined style={{ marginRight: 4 }} />
                            <Tag color={lv.color}>{lv.text}</Tag>
                            <Tag color={st.color}>{st.text}</Tag>
                            <span style={{ color: '#999', marginLeft: 8 }}>{date}</span>
                          </div>
                          {a.handlingHistory?.length > 0 && (
                            <div style={{ marginTop: 4, paddingLeft: 16, color: '#666', fontSize: 12 }}>
                              {a.handlingHistory.map((h, i) => (
                                <div key={i}>
                                  {h.action === 'handle' ? '处理' : '随访'}：{h.note || '无备注'}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ),
                    };
                  }
                  if (evt.type === 'assessment') {
                    const r = evt.data as AssessmentItem;
                    const c = levelMap[r.color] || { color: 'default', text: r.color };
                    return {
                      color: 'blue',
                      children: (
                        <div>
                          <MedicineBoxOutlined style={{ marginRight: 4 }} />
                          量表测评
                          <Tag color={c.color} style={{ marginLeft: 8 }}>{c.text}</Tag>
                          <span style={{ color: '#999', marginLeft: 8 }}>{date}</span>
                        </div>
                      ),
                    };
                  }
                  const iv = evt.data as InterviewItem;
                  const is = interviewStatusMap[iv.status] || {
                    color: 'default',
                    text: iv.status,
                  };
                  return {
                    color: 'purple',
                    children: (
                      <div>
                        访谈记录
                        <Tag color={is.color} style={{ marginLeft: 8 }}>{is.text}</Tag>
                        <span style={{ color: '#999', marginLeft: 8 }}>{date}</span>
                      </div>
                    ),
                  };
                })}
              />
            )}
          </Card>
        </Col>

        <Col span={10}>
          <Card
            title="预警记录"
            size="small"
            style={{ marginBottom: 16 }}
          >
            {profile.alertHistory.length === 0 ? (
              <Empty description="暂无预警记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <Table
                rowKey="id"
                size="small"
                pagination={false}
                dataSource={profile.alertHistory}
                columns={[
                  {
                    title: '等级',
                    dataIndex: 'level',
                    width: 80,
                    render: (v) => {
                      const info = levelMap[v] || { color: 'default', text: v };
                      return <Tag color={info.color}>{info.text}</Tag>;
                    },
                  },
                  { title: '状态', dataIndex: 'status', width: 80, render: (v) => {
                    const info = statusMap[v] || { color: 'default', text: v };
                    return <Tag color={info.color}>{info.text}</Tag>;
                  }},
                  {
                    title: '时间',
                    dataIndex: 'createdAt',
                    render: (v) => new Date(v).toLocaleDateString('zh-CN'),
                  },
                ]}
              />
            )}
          </Card>

          <Card
            title="测评历史"
            size="small"
          >
            {profile.assessmentHistory.length === 0 ? (
              <Empty description="暂无测评记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <Table
                rowKey="id"
                size="small"
                pagination={false}
                dataSource={profile.assessmentHistory}
                columns={[
                  {
                    title: '结果',
                    dataIndex: 'color',
                    width: 80,
                    render: (v) => {
                      const info = levelMap[v] || { color: 'default', text: v };
                      return <Tag color={info.color}>{info.text}</Tag>;
                    },
                  },
                  {
                    title: '时间',
                    dataIndex: 'createdAt',
                    render: (v) => new Date(v).toLocaleDateString('zh-CN'),
                  },
                ]}
              />
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={24}>
          <Card title="访谈记录">
            {profile.interviewHistory.length === 0 ? (
              <Empty description="暂无访谈记录" />
            ) : (
              <Table
                rowKey="id"
                size="small"
                pagination={false}
                dataSource={profile.interviewHistory}
                columns={[
                  { title: '类型', dataIndex: 'type', width: 100 },
                  {
                    title: '状态',
                    dataIndex: 'status',
                    width: 80,
                    render: (v) => {
                      const info = interviewStatusMap[v] || {
                        color: 'default',
                        text: v,
                      };
                      return <Tag color={info.color}>{info.text}</Tag>;
                    },
                  },
                  {
                    title: '时间',
                    dataIndex: 'createdAt',
                    render: (v) => new Date(v).toLocaleString('zh-CN'),
                  },
                  {
                    title: '备注',
                    dataIndex: 'notes',
                    ellipsis: true,
                  },
                  {
                    title: '操作',
                    width: 80,
                    render: (_, record) => (
                      <Button
                        type="link"
                        onClick={() =>
                          navigate(`${basePath}/interviews/${record.id}`)
                        }
                      >
                        查看
                      </Button>
                    ),
                  },
                ]}
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
