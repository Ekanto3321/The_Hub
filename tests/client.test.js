const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '..', 'client', 'src', 'App.js');
let content;
beforeAll(() => {
  content = fs.readFileSync(appPath, 'utf8');
});

describe('client/src/App.js surface checks', () => {
  test('server URL logic uses REACT_APP_SERVER_URL or window.location.hostname', () => {
    expect(content).toMatch(/process\.env\.REACT_APP_SERVER_URL/);
    expect(content).toMatch(/window\.location\.hostname/);
  });

  test('socket is created with io\\(serverUrl', () => {
    expect(content).toMatch(/io\(\s*serverUrl/);
    expect(content).toMatch(/transports:\s*\['websocket'\]/);
  });

  test('playback helper applyPlaybackToVideo exists', () => {
    expect(content).toMatch(/const\s+applyPlaybackToVideo\s*=\s*\(/);
    // ensure it tries to set currentTime or play/pause
    expect(content).toMatch(/v\.currentTime/);
    expect(content).toMatch(/v\.play\(/);
    expect(content).toMatch(/v\.pause\(/);
  });

  test('component emits playback-action and listens for room-state', () => {
    expect(content).toMatch(/socket\.emit\(\s*['"]playback-action['"]/);
    expect(content).toMatch(/socket\.on\(\s*['"]room-state['"]/);
  });
});
