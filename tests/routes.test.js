const routeStore = {
    posts: {},
    gets: {},
  };
  
  let mockMulterSingle;
  
  jest.mock(
    'express',
    () => ({
      Router: () => ({
        post: jest.fn((path, ...handlers) => {
          routeStore.posts[path] = handlers;
        }),
        get: jest.fn((path, handler) => {
          routeStore.gets[path] = handler;
        }),
      }),
    }),
    { virtual: true }
  );
  
  jest.mock(
    '@prisma/client',
    () => {
      const prisma = {
        user: {
          create: jest.fn(),
          findUnique: jest.fn(),
        },
        room: {
          create: jest.fn(),
          findUnique: jest.fn(),
          findMany: jest.fn(),
        },
        roomMember: {
          create: jest.fn(),
          upsert: jest.fn(),
        },
        media: {
          create: jest.fn(),
        },
        roomMedia: {
          create: jest.fn(),
        },
      };
  
      return {
        PrismaClient: jest.fn(() => prisma),
        __mockPrisma: prisma,
      };
    },
    { virtual: true }
  );
  
  jest.mock(
    'multer',
    () => {
      mockMulterSingle = jest.fn((req, res, next) => next());
      const multer = jest.fn(() => ({
        single: jest.fn(() => mockMulterSingle),
      }));
      multer.diskStorage = jest.fn(() => ({}));
      return multer;
    },
    { virtual: true }
  );
  
  jest.mock('fs', () => ({
    existsSync: jest.fn(() => true),
    mkdirSync: jest.fn(),
  }));
  
  function createRes() {
    return {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  }
  
  function resetRouteStore() {
    Object.keys(routeStore.posts).forEach((k) => delete routeStore.posts[k]);
    Object.keys(routeStore.gets).forEach((k) => delete routeStore.gets[k]);
  }
  
  describe('auth route tests', () => {
    let prisma;
  
    beforeEach(() => {
      jest.resetModules();
      resetRouteStore();
      require('../server/routes/auth');
      prisma = require('@prisma/client').__mockPrisma;
      jest.clearAllMocks();
    });
  
    test('POST /register creates user and returns public payload', async () => {
      prisma.user.create.mockResolvedValue({ id: 1, username: 'ekanto', password: '1234' });
  
      const req = { body: { username: 'ekanto', password: '1234' } };
      const res = createRes();
  
      await routeStore.posts['/register'][0](req, res);
  
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: { username: 'ekanto', password: '1234' },
      });
      expect(res.json).toHaveBeenCalledWith({
        id: 1,
        username: 'ekanto',
        rooms: [],
      });
    });
  
    test('POST /register returns 400 on create failure', async () => {
      prisma.user.create.mockRejectedValue(new Error('duplicate'));
  
      const req = { body: { username: 'ekanto', password: '1234' } };
      const res = createRes();
  
      await routeStore.posts['/register'][0](req, res);
  
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'User already exists or registration failed',
      });
    });
  
    test('POST /login returns user with rooms for valid credentials', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 7, username: 'ekanto', password: '1234' });
      prisma.room.findMany.mockResolvedValue([{ id: 'r1', code: 'ABC123', name: 'Watch Party' }]);
  
      const req = { body: { username: 'ekanto', password: '1234' } };
      const res = createRes();
  
      await routeStore.posts['/login'][0](req, res);
  
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { username: 'ekanto' },
      });
      expect(prisma.room.findMany).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        id: 7,
        username: 'ekanto',
        rooms: [{ id: 'r1', code: 'ABC123', name: 'Watch Party' }],
      });
    });
  
    test('POST /login returns 401 for invalid credentials', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 7, username: 'ekanto', password: 'wrong' });
  
      const req = { body: { username: 'ekanto', password: '1234' } };
      const res = createRes();
  
      await routeStore.posts['/login'][0](req, res);
  
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid credentials',
      });
    });
  });
  
  describe('room route tests', () => {
    let prisma;
  
    beforeEach(() => {
      jest.resetModules();
      resetRouteStore();
      require('../server/routes/room');
      prisma = require('@prisma/client').__mockPrisma;
      jest.clearAllMocks();
    });
  
    test('POST /create creates room and room member', async () => {
      prisma.room.create.mockResolvedValue({ id: 'r1', name: 'Test Room', code: 'ABC123', ownerId: 7 });
      prisma.roomMember.create.mockResolvedValue({});
  
      const req = { body: { name: 'Test Room', userId: 7 } };
      const res = createRes();
  
      await routeStore.posts['/create'][0](req, res);
  
      expect(prisma.room.create).toHaveBeenCalled();
      expect(prisma.roomMember.create).toHaveBeenCalledWith({
        data: { roomId: 'r1', userId: 7 },
      });
      expect(res.json).toHaveBeenCalledWith({
        id: 'r1',
        name: 'Test Room',
        code: 'ABC123',
        ownerId: 7,
      });
    });
  
    test('POST /create returns 400 when name or userId is missing', async () => {
      const req = { body: { name: '', userId: null } };
      const res = createRes();
  
      await routeStore.posts['/create'][0](req, res);
  
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Missing room name or user ID',
      });
    });
  
    test('POST /join returns 404 for invalid room code', async () => {
      prisma.room.findUnique.mockResolvedValue(null);
  
      const req = { body: { code: 'BAD999', userId: 7 } };
      const res = createRes();
  
      await routeStore.posts['/join'][0](req, res);
  
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid Room Code',
      });
    });
  
    test('POST /join returns 404 when user is not found', async () => {
      prisma.room.findUnique.mockResolvedValue({ id: 'r1', code: 'ABC123', name: 'Room A' });
      prisma.user.findUnique.mockResolvedValue(null);
  
      const req = { body: { code: 'ABC123', userId: 7 } };
      const res = createRes();
  
      await routeStore.posts['/join'][0](req, res);
  
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'User not found',
      });
    });
  
    test('POST /join returns room for valid room and user', async () => {
      prisma.room.findUnique.mockResolvedValue({ id: 'r1', code: 'ABC123', name: 'Room A' });
      prisma.user.findUnique.mockResolvedValue({ id: 7, username: 'ekanto' });
      prisma.roomMember.upsert.mockResolvedValue({});
  
      const req = { body: { code: 'ABC123', userId: 7 } };
      const res = createRes();
  
      await routeStore.posts['/join'][0](req, res);
  
      expect(prisma.roomMember.upsert).toHaveBeenCalledWith({
        where: { roomId_userId: { roomId: 'r1', userId: 7 } },
        update: {},
        create: { roomId: 'r1', userId: 7 },
      });
      expect(res.json).toHaveBeenCalledWith({
        id: 'r1',
        code: 'ABC123',
        name: 'Room A',
      });
    });
  
    test('GET /:roomId returns room context', async () => {
      prisma.room.findUnique.mockResolvedValue({
        id: 'r1',
        members: [],
        messages: [],
        media: [],
      });
  
      const req = { params: { roomId: 'r1' } };
      const res = createRes();
  
      await routeStore.gets['/:roomId'](req, res);
  
      expect(prisma.room.findUnique).toHaveBeenCalledWith({
        where: { id: 'r1' },
        include: {
          members: { include: { user: true } },
          messages: { include: { user: true }, orderBy: { createdAt: 'asc' } },
          media: { include: { media: true }, orderBy: { addedAt: 'asc' } },
        },
      });
      expect(res.json).toHaveBeenCalledWith({
        id: 'r1',
        members: [],
        messages: [],
        media: [],
      });
    });
  
    test('POST /:roomId/media returns 400 when no file is provided', async () => {
      const req = { params: { roomId: 'r1' }, file: undefined };
      const res = createRes();
  
      await routeStore.posts['/:roomId/media'][1](req, res);
  
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'No file provided',
      });
    });
  
    test('POST /:roomId/media stores media and room-media link', async () => {
      prisma.media.create.mockResolvedValue({
        id: 'm1',
        title: 'movie.mp4',
        filename: 'stored-movie.mp4',
        filePath: '/media/stored-movie.mp4',
        type: 'video/mp4',
      });
      prisma.roomMedia.create.mockResolvedValue({
        id: 'rm1',
        roomId: 'r1',
        mediaId: 'm1',
      });
  
      const req = {
        params: { roomId: 'r1' },
        file: {
          originalname: 'movie.mp4',
          filename: 'stored-movie.mp4',
          mimetype: 'video/mp4',
        },
      };
      const res = createRes();
  
      await routeStore.posts['/:roomId/media'][1](req, res);
  
      expect(prisma.media.create).toHaveBeenCalledWith({
        data: {
          title: 'movie.mp4',
          filename: 'stored-movie.mp4',
          filePath: '/media/stored-movie.mp4',
          type: 'video/mp4',
        },
      });
      expect(prisma.roomMedia.create).toHaveBeenCalledWith({
        data: { roomId: 'r1', mediaId: 'm1' },
      });
      expect(res.json).toHaveBeenCalledWith({
        id: 'rm1',
        roomId: 'r1',
        mediaId: 'm1',
        media: {
          id: 'm1',
          title: 'movie.mp4',
          filename: 'stored-movie.mp4',
          filePath: '/media/stored-movie.mp4',
          type: 'video/mp4',
        },
      });
    });
  });
