jest.mock(
    'express',
    () => {
      const mockUse = jest.fn();
      const mockPost = jest.fn();
      const mockApp = { use: mockUse, post: mockPost };
  
      const mockExpress = jest.fn(() => mockApp);
      mockExpress.json = jest.fn(() => 'json-middleware');
      mockExpress.static = jest.fn((dir) => `static:${dir}`);
      mockExpress.__mockUse = mockUse;
      mockExpress.__mockPost = mockPost;
      mockExpress.__mockApp = mockApp;
  
      return mockExpress;
    },
    { virtual: true }
  );
  
  jest.mock(
    'http',
    () => {
      const mockListen = jest.fn((port, cb) => {
        if (cb) cb();
        return { close: jest.fn() };
      });
      const mockServerInstance = { listen: mockListen };
      return {
        createServer: jest.fn(() => mockServerInstance),
      };
    },
    { virtual: true }
  );
  
  jest.mock(
    'socket.io',
    () => {
      const mockIoToEmit = jest.fn();
      const mockIoTo = jest.fn(() => ({ emit: mockIoToEmit }));
      const mockIoOn = jest.fn();
  
      const mockServerCtor = jest.fn(() => ({
        on: mockIoOn,
        to: mockIoTo,
      }));
  
      return {
        Server: mockServerCtor,
        __mockIoTo: mockIoTo,
        __mockIoToEmit: mockIoToEmit,
      };
    },
    { virtual: true }
  );
  
  jest.mock(
    '@prisma/client',
    () => ({
      PrismaClient: jest.fn(() => ({
        message: { create: jest.fn() },
      })),
    }),
    { virtual: true }
  );
  
  jest.mock(
    'multer',
    () => {
      const mockSingle = jest.fn(() => 'multer-single-middleware');
      const mockMulter = jest.fn(() => ({
        single: mockSingle,
      }));
      mockMulter.__mockSingle = mockSingle;
      return mockMulter;
    },
    { virtual: true }
  );
  
  jest.mock(
    'child_process',
    () => {
      const mockExec = jest.fn();
      return {
        exec: mockExec,
        __mockExec: mockExec,
      };
    },
    { virtual: true }
  );
  
  jest.mock(
    'fs',
    () => ({
      existsSync: jest.fn(() => true),
      mkdirSync: jest.fn(),
      unlinkSync: jest.fn(),
    }),
    { virtual: true }
  );
  
  jest.mock('cors', () => jest.fn(() => 'cors-middleware'), { virtual: true });
  jest.mock('../server/routes/auth', () => 'auth-routes');
  jest.mock('../server/routes/room', () => 'room-routes');
  
  function createRes() {
    return {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  }
  
  describe('upload-media transcoding behavior', () => {
    let express;
    let childProcess;
    let fs;
    let socketIo;
    let uploadHandler;
  
    beforeEach(() => {
      jest.resetModules();
      jest.clearAllMocks();
  
      require('../server/index');
  
      express = require('express');
      childProcess = require('child_process');
      fs = require('fs');
      socketIo = require('socket.io');
  
      const uploadRouteCall = express.__mockPost.mock.calls.find(
        ([path]) => path === '/upload-media'
      );
  
      uploadHandler = uploadRouteCall[2];
    });
  
    test('returns 400 if no file is uploaded', async () => {
      const req = {
        query: {},
        file: undefined,
      };
      const res = createRes();
  
      await uploadHandler(req, res);
  
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ ok: false, error: 'no-file' });
    });
  
    test('returns ready when media is already web-friendly', async () => {
      const req = {
        query: { roomId: 'room-1', title: 'My Video' },
        file: {
          path: '/tmp/uploaded-file',
          filename: 'uploaded-file',
          originalname: 'movie.mp4',
        },
      };
      const res = createRes();
  
      childProcess.__mockExec
        .mockImplementationOnce((cmd, cb) => cb(null, 'ffprobe version 6', ''))
        .mockImplementationOnce((cmd, cb) => cb(null, 'h264\n', ''))
        .mockImplementationOnce((cmd, cb) => cb(null, 'aac\n', ''))
        .mockImplementationOnce((cmd, cb) => cb(null, 'mp4,mov\n', ''));
  
      await uploadHandler(req, res);
  
      await new Promise((resolve) => setTimeout(resolve, 0));
  
      expect(res.json).toHaveBeenCalledWith({
        ok: true,
        status: 'ready',
        mediaUrl: '/media/uploaded-file',
        title: 'My Video',
      });
  
      expect(socketIo.__mockIoTo).toHaveBeenCalledWith('room-1');
      expect(socketIo.__mockIoToEmit).toHaveBeenCalledWith('media-ready', {
        roomId: 'room-1',
        mediaUrl: '/media/uploaded-file',
        title: 'My Video',
        origName: 'movie.mp4',
      });
    });
  
    test('starts shell-script transcoding when media is not web-friendly and script exists', async () => {
      const req = {
        query: { roomId: 'room-2', title: 'Clip' },
        file: {
          path: '/tmp/bad-upload',
          filename: 'bad-upload',
          originalname: 'clip.avi',
        },
      };
      const res = createRes();
  
      fs.existsSync.mockImplementation((target) => {
        if (String(target).includes('format_video.sh')) return true;
        return true;
      });
  
      childProcess.__mockExec
        .mockImplementationOnce((cmd, cb) => cb(null, 'ffprobe version 6', ''))
        .mockImplementationOnce((cmd, cb) => cb(null, 'mpeg4\n', ''))
        .mockImplementationOnce((cmd, cb) => cb(null, 'mp3\n', ''))
        .mockImplementationOnce((cmd, cb) => cb(null, 'avi\n', ''))
        .mockImplementationOnce((cmd, cb) => cb(null, '', ''));
  
      await uploadHandler(req, res);
  
      await new Promise((resolve) => setTimeout(resolve, 0));
  
      expect(res.json).toHaveBeenCalledWith({
        ok: true,
        status: 'transcoding',
        message: 'transcoding started',
      });
  
      expect(childProcess.__mockExec).toHaveBeenCalledWith(
        expect.stringContaining('bash'),
        expect.any(Function)
      );
  
      expect(socketIo.__mockIoTo).toHaveBeenCalledWith('room-2');
      expect(socketIo.__mockIoToEmit).toHaveBeenCalledWith('media-ready', {
        roomId: 'room-2',
        mediaUrl: '/media/bad-upload-transcoded.mp4',
        title: 'Clip',
        origName: 'clip.avi',
      });
  
      expect(fs.unlinkSync).toHaveBeenCalledWith('/tmp/bad-upload');
    });
  
    test('starts fallback ffmpeg transcoding when script is missing', async () => {
      const req = {
        query: { roomId: 'room-3', title: 'Fallback Video' },
        file: {
          path: '/tmp/needs-fallback',
          filename: 'needs-fallback',
          originalname: 'legacy.mkv',
        },
      };
      const res = createRes();
  
      fs.existsSync.mockImplementation((target) => {
        if (String(target).includes('format_video.sh')) return false;
        return true;
      });
  
      childProcess.__mockExec
        .mockImplementationOnce((cmd, cb) => cb(new Error('ffprobe missing'), '', ''))
        .mockImplementationOnce((cmd, cb) => cb(null, '', ''));
  
      await uploadHandler(req, res);
  
      await new Promise((resolve) => setTimeout(resolve, 0));
  
      expect(res.json).toHaveBeenCalledWith({
        ok: true,
        status: 'transcoding',
        message: 'transcoding started',
      });
  
      expect(childProcess.__mockExec).toHaveBeenCalledWith(
        expect.stringContaining('ffmpeg -y -i "/tmp/needs-fallback"'),
        expect.any(Function)
      );
  
      expect(socketIo.__mockIoTo).toHaveBeenCalledWith('room-3');
      expect(socketIo.__mockIoToEmit).toHaveBeenCalledWith('media-ready', {
        roomId: 'room-3',
        mediaUrl: '/media/needs-fallback-transcoded.mp4',
        title: 'Fallback Video',
        origName: 'legacy.mkv',
      });
    });
  });
