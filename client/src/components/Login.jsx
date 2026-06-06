// client/src/components/Login.jsx
import React, { useState } from 'react';
import { Window, WindowContent, WindowHeader, Button, TextField, Tab, Tabs } from 'react95';

export default function AuthPage({ onLogin, serverUrl }) {   // <--- added serverUrl
  const [activeTab, setActiveTab] = useState(0);
  const [usernameInput, setUsernameInput] = useState('');
  const [password, setPassword] = useState('');

  const handleAction = async () => {
    const endpoint = activeTab === 0 ? 'login' : 'register';
    try {
      const res = await fetch(`${serverUrl}/auth/${endpoint}`, {   // <--- use serverUrl
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameInput, password })
      });

      if (res.ok) {
        const userData = await res.json();
        onLogin(userData);
      } else {
        alert('Action failed: ' + (activeTab === 0 ? 'Check credentials' : 'User might exist'));
      }
    } catch (err) {
      alert('Network error. Is the server running?');
    }
  };

  return (
    <Window style={{ width: 350, margin: '50px auto' }}>
      <WindowHeader>The Hub - Access</WindowHeader>
      <Tabs value={activeTab} onChange={value => setActiveTab(value)}>
        <Tab value={0}>Login</Tab>
        <Tab value={1}>Sign Up</Tab>
      </Tabs>
      <WindowContent>
        <div style={{ marginBottom: '10px' }}>
          <p>Username:</p>
          <TextField fullWidth value={usernameInput} onChange={(e) => setUsernameInput(e.target.value)} />
        </div>
        <div style={{ marginBottom: '10px' }}>
          <p>Password:</p>
          <TextField fullWidth type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button fullWidth onClick={handleAction}>
          {activeTab === 0 ? 'Sign In' : 'Create Account'}
        </Button>
      </WindowContent>
    </Window>
  );
}
