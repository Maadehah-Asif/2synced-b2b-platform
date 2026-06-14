/**
 * Module: Campaign Performance Optimization (m09)
 * Layer: Backend
 * File: pythonRoiInvoker.ts
 * Purpose: Supports the p yt ho nR oi In vo ke r flow for this module.
 * Notes: Documentation header added for maintainability.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export type RoiPredictionResult = {
  predicted_roi: number;
  raw: Record<string, unknown>;
};

export type RoiModelMetadata = {
  model_type: string;
  model_version: string;
  mae: number | null;
  rmse: number | null;
  r2: number | null;
  feature_names: string[];
  roi_clip_min: number;
  roi_clip_max: number;
};

function buildMlModuleDir() {
  return path.resolve(process.cwd(), '..', 'ml', 'modules', 'm09');
}

function readJsonFile(filePath: string) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, any>;
  } catch {
    return {};
  }
}

export function loadRoiModelMetadata(): RoiModelMetadata {
  const moduleDir = buildMlModuleDir();
  const rootModelDir = path.resolve(process.cwd(), '..', 'ml', 'models', 'm09', 'v1');
  const moduleModelDir = path.join(moduleDir, 'models', 'm09', 'v1');
  const modelDir = fs.existsSync(path.join(rootModelDir, 'metrics.json')) ? rootModelDir : moduleModelDir;
  const metrics = readJsonFile(path.join(modelDir, 'metrics.json'));
  const manifest = readJsonFile(path.join(modelDir, 'feature_manifest.json'));
  return {
    model_type: String(metrics.model?.type || manifest.model_type_saved || 'GradientBoostingRegressor'),
    model_version: 'm09/v1',
    mae: toNumber(metrics.metrics?.mae),
    rmse: toNumber(metrics.metrics?.rmse),
    r2: toNumber(metrics.metrics?.r2),
    feature_names: Array.isArray(manifest.feature_names) ? manifest.feature_names.map(String) : [],
    roi_clip_min: toNumber(manifest.roi_clip_min) ?? -1,
    roi_clip_max: toNumber(manifest.roi_clip_max) ?? 5,
  };
}

export async function invokePythonRoiPrediction(payload: Record<string, unknown>): Promise<RoiPredictionResult> {
  const pythonExec = process.env.PYTHON_EXECUTABLE || process.env.PYTHON || 'python';
  const moduleDir = buildMlModuleDir();
  const scriptPath = path.join(moduleDir, 'predict_roi.py');

  return new Promise<RoiPredictionResult>((resolve, reject) => {
    const child = spawn(pythonExec, [scriptPath], {
      cwd: moduleDir,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error('roi_prediction_timeout'));
    }, 20_000);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(stderr || `roi_prediction_exit_code_${code}`));
        return;
      }
      try {
        const parsed = JSON.parse(stdout || '{}') as Record<string, unknown>;
        const predicted = toNumber(parsed.predicted_roi);
        if (predicted === null) {
          reject(new Error('roi_prediction_missing_predicted_roi'));
          return;
        }
        resolve({ predicted_roi: predicted, raw: parsed });
      } catch {
        reject(new Error('roi_prediction_invalid_json'));
      }
    });

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
