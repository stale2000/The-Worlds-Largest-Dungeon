import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { getTableCounts } from './db.js';
import { spellsRouter } from './routes/spells.js';
import { monstersRouter } from './routes/monsters.js';
import { equipmentRouter } from './routes/equipment.js';
import { roomsRouter } from './routes/rooms.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  try {
    const tables = getTableCounts();
    res.json({
      status: 'ok',
      tables,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// API Routes
app.use('/spells', spellsRouter);
app.use('/monsters', monstersRouter);
app.use('/equipment', equipmentRouter);
app.use('/rooms', roomsRouter);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not found',
    message: 'The requested endpoint does not exist',
  });
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`SQLite server listening on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

export { app };
