import * as winston from 'winston';
import { WinstonModuleOptions } from 'nest-winston';
import { Logger as NestLogger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

// Add the custom Logger interface
export interface Logger extends NestLogger {
  info(message: string, ...optionalParams: any[]): void;
  debug(message: string, ...optionalParams: any[]): void;
  warn(message: string, ...optionalParams: any[]): void;
  error(message: string, ...optionalParams: any[]): void;
}

// Define custom log levels and colors
export const customLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
  },
  colors: {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    debug: 'blue',
  },
};

// Format log information
const formatLogInfo = (info: any) => {
  const { level, message, meta } = info;
  const timestamp = new Date().toISOString();
  const metaMsg = meta ? `: ${JSON.stringify(meta, null, 2)}` : '';
  let className = info.className || '';
  className = className ? `[${className}] ` : '';
  return `${timestamp} ${level.toUpperCase()}: ${className}${message}${metaMsg}`;
};

// Common format for file transports
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.json()
);

const logDir = process.env.LOG_DIR || 'logs';
// Create logs directory if it doesn't exist
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

export const loggerConfig: WinstonModuleOptions = {
  levels: customLevels.levels,
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  transports: [
    // Console transport
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.colorize(),
        winston.format.printf(formatLogInfo),
      ),
    }),
    // Combined log file
    new winston.transports.File({
      level: 'info',
      filename: path.join(logDir, 'app.log'),
      handleExceptions: true,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: fileFormat,
    }),
    // Error-only log file
    new winston.transports.File({
      level: 'error',
      filename: path.join(logDir, 'app.log'),
      handleExceptions: true,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: fileFormat,
    }),
    // Debug log file (if DEBUG environment variable is set)
    ...(process.env.DEBUG ? [
      new winston.transports.File({
        level: 'debug',
        filename: path.join(logDir, 'app.log'),
        handleExceptions: true,
        maxsize: 5242880, // 5MB
        maxFiles: 2,
        format: fileFormat,
      })
    ] : []),
  ],
};

// Apply colors to winston
winston.addColors(customLevels.colors);