import { useRef, useState } from 'react';
import { ProTable, type ActionType } from '@ant-design/pro-components';
import {
  Button,
  Modal,
  Form,
  Input,
  Select,
  Upload,
  Table,
  Tag,
  message,
  Space,
} from 'antd';
import { UploadOutlined, DownloadOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import request from '../../utils/request';

interface ImportError {
  row: number;
  field: string;
  message: string;
}

interface ImportResult {
  total: number;
  created: number;
  skipped: number;
  errors: ImportError[];
}

export default function StudentManage() {
  const actionRef = useRef<ActionType>();
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [classes, setClasses] = useState<any[]>([]);
  const [form] = Form.useForm();

  const openCreate = async () => {
    const res: any = await request.get('/admin/classes', {
      params: { page: 1, pageSize: 100 },
    });
    setClasses(res.data || res || []);
    setOpen(true);
  };

  const handleCreate = async (values: any) => {
    try {
      await request.post('/admin/students', values);
      message.success('创建成功');
      setOpen(false);
      form.resetFields();
      actionRef.current?.reload();
    } catch {
      message.error('创建失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await request.delete(`/admin/students/${id}`);
      message.success('删除成功');
      actionRef.current?.reload();
    } catch {
      message.error('删除失败');
    }
  };

  const handleImport = async () => {
    if (!fileList.length) return message.warning('请选择文件');
    const formData = new FormData();
    const file = (fileList[0] as { originFileObj?: Blob }).originFileObj ?? (fileList[0] as unknown as Blob);
    formData.append('file', file);
    setImporting(true);
    try {
      const res: any = await request.post('/admin/students/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportResult(res);
      setImportOpen(false);
      setFileList([]);
      setResultOpen(true);
      actionRef.current?.reload();
    } catch (err: any) {
      const msg = err.response?.data?.message || '导入失败';
      message.error(msg);
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadTemplate = () => {
    window.open('/api/admin/students/import/template', '_blank');
  };

  const errorColumns = [
    { title: '行号', dataIndex: 'row', key: 'row', width: 80 },
    { title: '字段', dataIndex: 'field', key: 'field', width: 120 },
    { title: '错误信息', dataIndex: 'message', key: 'message' },
  ];

  const columns = [
    { title: '姓名', dataIndex: 'name', key: 'name' },
    { title: '学号', dataIndex: 'studentNo', key: 'studentNo' },
    { title: '班级ID', dataIndex: 'classId', key: 'classId', ellipsis: true },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Button type="link" danger onClick={() => handleDelete(record.id)}>
          删除
        </Button>
      ),
    },
  ];

  return (
    <>
      <ProTable
        rowKey="id"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const res: any = await request.get('/admin/students', {
            params: { page: params.current, pageSize: params.pageSize },
          });
          return { data: res.data || res, total: res.total, success: true };
        }}
        toolBarRender={() => [
          <Button
            key="import"
            icon={<UploadOutlined />}
            onClick={() => setImportOpen(true)}
          >
            导入学生
          </Button>,
          <Button
            key="template"
            icon={<DownloadOutlined />}
            onClick={handleDownloadTemplate}
          >
            下载模板
          </Button>,
          <Button key="create" type="primary" onClick={openCreate}>
            新建学生
          </Button>,
        ]}
        search={false}
      />
      <Modal
        title="新建学生"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="name" label="姓名" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="studentNo" label="学号" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="classId"
            label="所属班级"
            rules={[{ required: true }]}
          >
            <Select
              options={classes.map((c: any) => ({
                label: c.name,
                value: c.id,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title="导入学生"
        open={importOpen}
        onOk={handleImport}
        onCancel={() => {
          setImportOpen(false);
          setFileList([]);
        }}
        confirmLoading={importing}
        okText="开始导入"
      >
        <Upload
          beforeUpload={() => false}
          maxCount={1}
          accept=".xlsx,.xls"
          fileList={fileList}
          onChange={({ fileList: fl }) => setFileList(fl)}
        >
          <Button icon={<UploadOutlined />}>选择 Excel 文件</Button>
        </Upload>
        <div style={{ marginTop: 8, color: '#999', fontSize: 12 }}>
          支持 .xlsx 格式，文件大小不超过 5MB
        </div>
      </Modal>
      <Modal
        title="导入结果"
        open={resultOpen}
        onCancel={() => setResultOpen(false)}
        footer={<Button onClick={() => setResultOpen(false)}>关闭</Button>}
        width={600}
      >
        {importResult && (
          <>
            <Space size="large" style={{ marginBottom: 16 }}>
              <span>
                总计: <strong>{importResult.total}</strong>
              </span>
              <span>
                <Tag color="success">新建: {importResult.created}</Tag>
              </span>
              <span>
                <Tag color="warning">跳过: {importResult.skipped}</Tag>
              </span>
            </Space>
            {importResult.errors.length > 0 && (
              <>
                <div style={{ marginBottom: 8, fontWeight: 500 }}>
                  错误明细：
                </div>
                <Table
                  size="small"
                  pagination={false}
                  dataSource={importResult.errors}
                  columns={errorColumns}
                  rowKey={(_, idx) => String(idx)}
                  scroll={{ y: 300 }}
                />
              </>
            )}
          </>
        )}
      </Modal>
    </>
  );
}
