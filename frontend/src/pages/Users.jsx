import React, { useState, useEffect } from 'react';
import { Table, Card, Button, Tag, Space, Drawer, List, Typography } from 'antd';
import { ReloadOutlined, EyeOutlined } from '@ant-design/icons';
import api from '../api.js';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userLocks, setUserLocks] = useState([]);
  const [userBookings, setUserBookings] = useState([]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/users');
      setUsers(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const viewUserDetail = async (user) => {
    setSelectedUser(user);
    setDetailVisible(true);
    try {
      const [locksRes, bookingsRes] = await Promise.all([
        api.get(`/users/${user.id}/locks`),
        api.get(`/users/${user.id}/bookings`),
      ]);
      setUserLocks(locksRes.data);
      setUserBookings(bookingsRes.data);
    } catch (e) {
      console.error(e);
    }
  };

  const columns = [
    {
      title: '用户名',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      key: 'phone',
    },
    {
      title: '注册时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (t) => dayjs(t).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button size="small" icon={<EyeOutlined />} onClick={() => viewUserDetail(record)}>
          查看详情
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>用户列表</Title>
        <Button icon={<ReloadOutlined />} onClick={loadUsers}>刷新</Button>
      </div>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={users}
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Drawer
        title="用户详情"
        width={500}
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
      >
        {selectedUser && (
          <div>
            <Title level={5}>基本信息</Title>
            <List size="small">
              <List.Item>
                <List.Item.Meta title="用户名" description={selectedUser.name} />
              </List.Item>
              <List.Item>
                <List.Item.Meta title="手机号" description={selectedUser.phone} />
              </List.Item>
            </List>

            <Title level={5} style={{ marginTop: 24 }}>当前锁定名额</Title>
            {userLocks.length > 0 ? (
              <List
                size="small"
                dataSource={userLocks}
                renderItem={(item) => (
                  <List.Item>
                    <List.Item.Meta
                      title={
                        <Space>
                          <span>{item.show_name}</span>
                          <Tag color="orange">{item.tier_name}</Tag>
                        </Space>
                      }
                      description={
                        <div>
                          <div>{item.consecutive_count}连座</div>
                          <div style={{ color: '#999' }}>
                            过期时间: {dayjs(item.expires_at).format('MM-DD HH:mm:ss')}
                          </div>
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Text type="secondary">暂无锁定名额</Text>
            )}

            <Title level={5} style={{ marginTop: 24 }}>已确认订单</Title>
            {userBookings.length > 0 ? (
              <List
                size="small"
                dataSource={userBookings}
                renderItem={(item) => (
                  <List.Item>
                    <List.Item.Meta
                      title={
                        <Space>
                          <span>{item.show_name}</span>
                          <Tag color="green">{item.tier_name}</Tag>
                        </Space>
                      }
                      description={
                        <div>
                          <div>{item.consecutive_count}连座</div>
                          <div style={{ color: '#999' }}>
                            确认时间: {dayjs(item.confirmed_at).format('MM-DD HH:mm:ss')}
                          </div>
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Text type="secondary">暂无已确认订单</Text>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}

export default Users;
