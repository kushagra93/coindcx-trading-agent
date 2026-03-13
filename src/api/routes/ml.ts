import type { FastifyInstance, FastifyReply } from 'fastify';
import { assertPermission, PermissionError } from '../../permissions/permissions.js';
import { config } from '../../core/config.js';
import { getInferenceBackend } from '../../data/llm.js';
import type { AuthContext } from '../../core/types.js';

function getAuthContext(request: any): AuthContext {
  return {
    userId: request.userId as string,
    tier: request.tier as 'admin' | 'ops' | 'user',
    hostApp: 'default',
  };
}

function handlePermissionError(err: unknown, reply: FastifyReply) {
  if (err instanceof PermissionError) {
    return reply.status(403).send({ error: err.message });
  }
  throw err;
}

export async function mlRoutes(app: FastifyInstance) {

  // ─── ML Status Overview ─────────────────────────────────────────────

  app.get('/api/v1/ml/status', async (request, reply) => {
    const ctx = getAuthContext(request);
    try {
      assertPermission(ctx, 'ops.view-trade-logs');
    } catch (err) {
      return handlePermissionError(err, reply);
    }

    const { listTrainingJobs, listEndpoints } = await import('../../ml/sagemaker.js');

    const [jobs, endpoints] = await Promise.all([
      listTrainingJobs(5).catch(() => []),
      listEndpoints().catch(() => []),
    ]);

    return {
      inferenceBackend: getInferenceBackend(),
      sagemaker: {
        region: config.sagemaker.region,
        s3Bucket: config.sagemaker.s3Bucket,
        intentEndpoint: config.sagemaker.intentEndpointName || null,
        chatEndpoint: config.sagemaker.chatEndpointName || null,
        useSageMakerInference: config.sagemaker.useSageMakerInference,
      },
      recentTrainingJobs: jobs,
      endpoints,
    };
  });

  // ─── Export Training Data ───────────────────────────────────────────

  app.post('/api/v1/ml/export', async (request, reply) => {
    const ctx = getAuthContext(request);
    try {
      assertPermission(ctx, 'ops.view-trade-logs');
    } catch (err) {
      return handlePermissionError(err, reply);
    }

    const body = request.body as { type?: 'intent' | 'trades' | 'all' } | undefined;
    const exportType = body?.type || 'all';

    const {
      exportIntentTrainingData,
      exportTradeOutcomeData,
      exportAllTrainingData,
    } = await import('../../ml/data-export.js');

    if (exportType === 'intent') {
      const result = await exportIntentTrainingData();
      return { success: true, export: result };
    }

    if (exportType === 'trades') {
      const result = await exportTradeOutcomeData();
      return { success: true, export: result };
    }

    const result = await exportAllTrainingData();
    return { success: true, export: result };
  });

  // ─── Start Training Job ─────────────────────────────────────────────

  app.post('/api/v1/ml/train', async (request, reply) => {
    const ctx = getAuthContext(request);
    try {
      assertPermission(ctx, 'ops.view-trade-logs');
    } catch (err) {
      return handlePermissionError(err, reply);
    }

    const body = request.body as {
      s3TrainDataUri?: string;
      baseModel?: string;
      hyperparameters?: Record<string, string>;
      instanceType?: string;
    } | undefined;

    if (!body?.s3TrainDataUri) {
      return reply.status(400).send({
        error: 'Missing s3TrainDataUri. Export training data first via POST /api/v1/ml/export',
      });
    }

    const { startTrainingJob } = await import('../../ml/sagemaker.js');

    const result = await startTrainingJob({
      s3TrainDataUri: body.s3TrainDataUri,
      baseModel: body.baseModel,
      hyperparameters: body.hyperparameters,
      instanceType: body.instanceType,
    });

    return { success: true, trainingJob: result };
  });

  // ─── Training Job Status ────────────────────────────────────────────

  app.get('/api/v1/ml/train/:jobName', async (request, reply) => {
    const ctx = getAuthContext(request);
    try {
      assertPermission(ctx, 'ops.view-trade-logs');
    } catch (err) {
      return handlePermissionError(err, reply);
    }

    const { jobName } = request.params as { jobName: string };
    const { getTrainingJobStatus } = await import('../../ml/sagemaker.js');

    const status = await getTrainingJobStatus(jobName);
    return { trainingJob: status };
  });

  // ─── Deploy Model to Endpoint ───────────────────────────────────────

  app.post('/api/v1/ml/deploy', async (request, reply) => {
    const ctx = getAuthContext(request);
    try {
      assertPermission(ctx, 'ops.view-trade-logs');
    } catch (err) {
      return handlePermissionError(err, reply);
    }

    const body = request.body as {
      modelArtifactsS3Uri: string;
      endpointName: string;
      instanceType?: string;
    } | undefined;

    if (!body?.modelArtifactsS3Uri || !body?.endpointName) {
      return reply.status(400).send({
        error: 'Missing modelArtifactsS3Uri or endpointName',
      });
    }

    const { deployModel } = await import('../../ml/sagemaker.js');

    const result = await deployModel({
      modelArtifactsS3Uri: body.modelArtifactsS3Uri,
      endpointName: body.endpointName,
      instanceType: body.instanceType,
    });

    return { success: true, endpoint: result };
  });

  // ─── Endpoint Status ────────────────────────────────────────────────

  app.get('/api/v1/ml/endpoints/:name', async (request, reply) => {
    const ctx = getAuthContext(request);
    try {
      assertPermission(ctx, 'ops.view-trade-logs');
    } catch (err) {
      return handlePermissionError(err, reply);
    }

    const { name } = request.params as { name: string };
    const { getEndpointStatus } = await import('../../ml/sagemaker.js');

    const status = await getEndpointStatus(name);
    return { endpoint: status };
  });

  // ─── Delete Endpoint ────────────────────────────────────────────────

  app.delete('/api/v1/ml/endpoints/:name', async (request, reply) => {
    const ctx = getAuthContext(request);
    try {
      assertPermission(ctx, 'ops.view-trade-logs');
    } catch (err) {
      return handlePermissionError(err, reply);
    }

    const { name } = request.params as { name: string };
    const { deleteEndpoint } = await import('../../ml/sagemaker.js');

    await deleteEndpoint(name);
    return { success: true, message: `Endpoint ${name} deletion initiated` };
  });

  // ─── Full Pipeline: Export → Train ──────────────────────────────────

  app.post('/api/v1/ml/pipeline', async (request, reply) => {
    const ctx = getAuthContext(request);
    try {
      assertPermission(ctx, 'ops.view-trade-logs');
    } catch (err) {
      return handlePermissionError(err, reply);
    }

    const body = request.body as {
      baseModel?: string;
      instanceType?: string;
    } | undefined;

    const { exportIntentTrainingData } = await import('../../ml/data-export.js');
    const { startTrainingJob } = await import('../../ml/sagemaker.js');

    const exportResult = await exportIntentTrainingData();
    const s3Dir = exportResult.s3Uri.replace(/\/[^/]+$/, '/');

    const trainingResult = await startTrainingJob({
      s3TrainDataUri: s3Dir,
      baseModel: body?.baseModel,
      instanceType: body?.instanceType,
    });

    return {
      success: true,
      pipeline: {
        export: exportResult,
        trainingJob: trainingResult,
        nextSteps: [
          `Monitor: GET /api/v1/ml/train/${trainingResult.jobName}`,
          'After completion, deploy: POST /api/v1/ml/deploy with modelArtifactsS3Uri from training job',
          'Update SAGEMAKER_INTENT_ENDPOINT and SAGEMAKER_USE_INFERENCE=true to switch to fine-tuned model',
        ],
      },
    };
  });
}