import React, { useState } from 'react';
import { Layout, Menu, Typography } from 'antd';
import {
  CalendarOutlined,
  UserOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import ShowList from './pages/ShowList.jsx';
import ShowDetail from './pages/ShowDetail.jsx';
import Users from './pages/Users.jsx';

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const menuItems = [
    {
      key: '/shows',
      icon: <CalendarOutlined />,
      label: '演出管理',
    },
    {
      key: '/users',
      icon: <UserOutlined />,
      label: '用户管理',
    },
  ];

  const getSelectedKey = () => {
    if (location.pathname.startsWith('/shows')) return '/shows';
    if (location.pathname.startsWith('/users')) return '/users';
    return '/shows';
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed}>
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: collapsed ? 16 : 20, fontWeight: 'bold' }}>
          {collapsed ? '候' : '候补递补'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[getSelectedKey()]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center' }}>
          <Title level={4} style={{ margin: 0 }}>退票候补递补服务 - 运营管理台</Title>
        </Header>
        <Content style={{ margin: '24px', padding: 24, background: '#fff', borderRadius: 8 }}>
          <Routes>
            <Route path="/" element={<ShowList />} />
            <Route path="/shows" element={<ShowList />} />
            <Route path="/shows/:showId" element={<ShowDetail />} />
            <Route path="/users" element={<Users />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
