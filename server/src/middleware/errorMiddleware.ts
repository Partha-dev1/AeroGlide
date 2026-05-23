import { Request, Response, NextFunction } from 'express';

export const errorMiddleware = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('❌ Express Server Error Context:', err.stack || err.message || err);
  
  const status = err.status || 500;
  const message = err.message || 'An unexpected server error occurred.';
  
  return res.status(status).json({
    error: message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
};
