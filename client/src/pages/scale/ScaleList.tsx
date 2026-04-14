import { useRef, useState } from 'react';
import { ProTable, type ActionType, type ProColumns } from '@ant-design/pro-components';
import { Button, Upload, Modal, Popconfirm, message } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import request from '../../utils/request';

export default function ScaleList() {
  const actionRef = useRef<ActionType>();
  const [importOpen, setImportOpen] = useState(false);
  const [fileList, setFileList] = useState<any[]>([]);
  const navigate = useNavigate();
  const location = useLocation();

  const basePath = location.pathname.startsWith('/admin') ? '/admin' : '/teacher';

  const handleDelete = async (id: string) => {
    try {
      await request.delete(`/scales/${id}`);
      message.success('删除成功');
      actionRef.current?.reload();
    } catch {
      message.error('删除失败');
    }
  };

  const handleImport = async () => {
    if (!fileList.length) return message.warning('请选择文件');
    const formData = new FormData();
    const file = fileList[0].originFileObj || fileList[0];
    formData.append('file', file);
    try {
      await request.post('/scales/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      message.success('导入成功');
      setImportOpen(false);
      setFileList([]);
      actionRef.current?.reload();
    } catch (err: any) {
      const msg = err.response?.data?.message || '导入失败';
      message.error(msg);
    }
  };

  const columns: ProColumns[] = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '版本', dataIndex: 'version', key: 'version', width: 80 },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_: any, record: any) => (
        <>
          <Button type="link" onClick={() => navigate(`${basePath}/scales/${record.id}`)}>
            编辑
          </Button>
          <Popconfirm title="确定删除此量表？" onConfirm={() => handleDelete(record.id)} okText="删除" cancelText="取消">
            <Button type="link" danger>删除</Button>
          </Popconfirm>
        </>
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
          const res: any = await request.get('/scales', { params: { page: params.current, pageSize: params.pageSize } });
          return { data: res.data || res, total: res.total, success: true };
        }}
        toolBarRender={() => [
          <Button key="import" icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>
            导入量表
          </Button>,
        ]}
        search={false}
      />
      <Modal title="导入量表" open={importOpen} onOk={handleImport} onCancel={() => setImportOpen(false)}>
        <Upload beforeUpload={() => false} maxCount={1} fileList={fileList} onChange={({ fileList }) => setFileList(fileList)}>
          <Button icon={<UploadOutlined />}>选择文件</Button>
        </Upload>
      </Modal>
    </>
  );
}
