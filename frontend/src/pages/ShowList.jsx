import React, { useState, useEffect } from 'react';
import { Table, Card, Tag, Space, Button, Typography } from 'antd';
import { EyeOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../api.js';
import dayjs from 'dayjs';

const { Title } = Typography;

function ShowList() {
  const navigate = useNavigate();
  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadShows = async () => {
    setLoading(true);
    try {
      const res = await api.get('/shows');
      setShows(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShows();
  }, []);

  const columns = [
    {
      title: '演出名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space direction="vertical" size={0}>
          <span style={{ fontWeight: 'bold' }}>{text}</span>
          <span style={{ color: '#999', fontSize: 12 }}>{record.venue}</span>
        </Space>
      ),
    },
    {
      title: '演出时间',
      dataIndex: 'date',
      key: 'date',
      render: (text) => dayjs(text).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button
          type="primary"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => navigate(`/shows/${record.id}`)}
        >
          查看详情
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>演出列表</Title>
        <Button icon={<ReloadOutlined />} onClick={loadShows}>刷新</Button>
      </div>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={shows}
        loading={loading}
        pagination={false}
      />
    </div>
  );
}

export default ShowList;
