import React, { useState } from 'react';
import {
  Window,
  WindowContent,
  WindowHeader,
  Button,
  TextField,
  Tab,
  Tabs,
} from 'react95';

export default function AuthPage({ onLogin, serverUrl }) {
  const [activeTab, setActiveTab] = useState(0);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleAction = async () => {
    const endpoint = activeTab === 0 ? 'login' : 'register';

    const res = await fetch(`${serverUrl}/auth/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (res.ok) {
      onLogin(username);
    } else {
      alert(
        'Action failed: ' +
          (activeTab === 0 ? 'Check credentials' : 'User might exist')
      );
    }
  };

  return (
    <Window style={{ width: 350, margin: '50px auto' }}>
      <WindowHeader>The Hub - Access</WindowHeader>
      <Tabs value={activeTab} onChange={(value) => setActiveTab(value)}>
        <Tab value={0}>Login</Tab>
        <Tab value={1}>Sign Up</Tab>
      </Tabs>
      <WindowContent>
        <div style={{ marginBottom: '10px' }}>
          <p>Username:</p>
          <TextField
            fullWidth
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div style={{ marginBottom: '10px' }}>
          <p>Password:</p>
          <TextField
            fullWidth
            type="password"
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button fullWidth onClick={handleAction}>
          {activeTab === 0 ? 'Sign In' : 'Create Account'}
        </Button>
      </WindowContent>
    </Window>
  );
}
