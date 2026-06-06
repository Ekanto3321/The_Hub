const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, '..', 'server', 'index.js');
let content;
beforeAll(() => {
  content = fs.readFileSync(serverPath, 'utf8');
});

describe('server/index.js basic surface checks', () => {
  test('exports/handlers presence: io connection and playback-action handler', () => {
    expect(content).toMatch(/io\.on\(\s*['"]connection['"]/);
    expect(content).toMatch(/socket\.on\(\s*['"]playback-action['"]/);
    expect(content).toMatch(/socket\.on\(\s*['"]send-message['"]/);
    expect(content).toMatch(/socket\.on\(\s*['"]request-playback['"]/);
  });

  test('roomPlayback state variable exists and is initialized', () => {
    expect(content).toMatch(/const\s+roomPlayback\s*=\s*{\s*}/);
  });

  test('server listens on port 3001', () => {
    // allow small whitespace/linebreak variations
    expect(content).toMatch(/server\.listen\(\s*3001\s*,/);
    // also accept server.listen(3001, ...) or server.listen(3001)
    expect(content).toMatch(/server\.listen\(\s*3001/);
  });

  test('socket broadcasts include roomId and use socket.to or io.to', () => {
    expect(content).toMatch(/socket\.to\(\s*roomId\s*\)\.emit\(\s*['"]sync-state['"]/);
    expect(content).toMatch(/io\.to\(\s*roomId\s*\)\.emit\(\s*['"]chat-message['"]/);
  });
});
