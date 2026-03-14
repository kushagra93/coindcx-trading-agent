import {
  SageMakerClient,
  CreateTrainingJobCommand,
  DescribeTrainingJobCommand,
  CreateModelCommand,
  CreateEndpointConfigCommand,
  CreateEndpointCommand,
  DescribeEndpointCommand,
  DeleteEndpointCommand,
  DeleteEndpointConfigCommand,
  DeleteModelCommand,
  ListTrainingJobsCommand,
  ListEndpointsCommand,
  type TrainingInstanceType,
  type ProductionVariantInstanceType,
} from '@aws-sdk/client-sagemaker';
import {
  SageMakerRuntimeClient,
  InvokeEndpointCommand,
} from '@aws-sdk/client-sagemaker-runtime';
import { config } from '../core/config.js';
import { createChildLogger } from '../core/logger.js';

const log = createChildLogger('sagemaker');

let _client: SageMakerClient | null = null;
let _runtime: SageMakerRuntimeClient | null = null;

function getClient(): SageMakerClient {
  if (_client) return _client;
  _client = new SageMakerClient({ region: config.sagemaker.region });
  return _client;
}

function getRuntime(): SageMakerRuntimeClient {
  if (_runtime) return _runtime;
  _runtime = new SageMakerRuntimeClient({ region: config.sagemaker.region });
  return _runtime;
}

// HuggingFace Deep Learning Container images by region
const HF_TGI_IMAGES: Record<string, string> = {
  'us-west-2': '763104351884.dkr.ecr.us-west-2.amazonaws.com/huggingface-pytorch-tgi-inference:2.1.1-tgi1.4.2-gpu-py310-cu121-ubuntu22.04',
  'us-east-1': '763104351884.dkr.ecr.us-east-1.amazonaws.com/huggingface-pytorch-tgi-inference:2.1.1-tgi1.4.2-gpu-py310-cu121-ubuntu22.04',
  'eu-west-1': '763104351884.dkr.ecr.eu-west-1.amazonaws.com/huggingface-pytorch-tgi-inference:2.1.1-tgi1.4.2-gpu-py310-cu121-ubuntu22.04',
  'ap-south-1': '763104351884.dkr.ecr.ap-south-1.amazonaws.com/huggingface-pytorch-tgi-inference:2.1.1-tgi1.4.2-gpu-py310-cu121-ubuntu22.04',
};

const HF_TRAINING_IMAGES: Record<string, string> = {
  'us-west-2': '763104351884.dkr.ecr.us-west-2.amazonaws.com/huggingface-pytorch-training:2.1.0-transformers4.36.0-gpu-py310-cu121-ubuntu20.04',
  'us-east-1': '763104351884.dkr.ecr.us-east-1.amazonaws.com/huggingface-pytorch-training:2.1.0-transformers4.36.0-gpu-py310-cu121-ubuntu20.04',
  'eu-west-1': '763104351884.dkr.ecr.eu-west-1.amazonaws.com/huggingface-pytorch-training:2.1.0-transformers4.36.0-gpu-py310-cu121-ubuntu20.04',
  'ap-south-1': '763104351884.dkr.ecr.ap-south-1.amazonaws.com/huggingface-pytorch-training:2.1.0-transformers4.36.0-gpu-py310-cu121-ubuntu20.04',
};

export interface TrainingJobConfig {
  jobName?: string;
  s3TrainDataUri: string;
  baseModel?: string;
  hyperparameters?: Record<string, string>;
  instanceType?: string;
  instanceCount?: number;
  maxRuntimeSeconds?: number;
}

export interface TrainingJobStatus {
  jobName: string;
  status: string;
  secondaryStatus?: string;
  modelArtifacts?: string;
  failureReason?: string;
  createdAt?: Date;
  lastModifiedAt?: Date;
}

export interface EndpointInfo {
  name: string;
  status: string;
  createdAt?: Date;
}

/**
 * Launch a SageMaker training job for fine-tuning the intent model.
 * Uses HuggingFace training containers with LoRA/QLoRA for efficient fine-tuning.
 */
export async function startTrainingJob(cfg: TrainingJobConfig): Promise<TrainingJobStatus> {
  const client = getClient();
  const region = config.sagemaker.region;
  const roleArn = config.sagemaker.roleArn;

  if (!roleArn) throw new Error('SAGEMAKER_ROLE_ARN not configured');

  const jobName = cfg.jobName || `cerebro-intent-${Date.now()}`;
  const baseModel = cfg.baseModel || config.sagemaker.baseModelId;
  const instanceType = cfg.instanceType || config.sagemaker.trainingInstanceType;
  const trainingImage = HF_TRAINING_IMAGES[region];

  if (!trainingImage) {
    throw new Error(`No HuggingFace training image configured for region ${region}`);
  }

  const outputPath = `s3://${config.sagemaker.s3Bucket}/${config.sagemaker.s3Prefix}/models`;

  const hyperparameters: Record<string, string> = {
    model_name_or_path: baseModel,
    train_file: '/opt/ml/input/data/train/train.jsonl',
    output_dir: '/opt/ml/model',
    num_train_epochs: '3',
    per_device_train_batch_size: '4',
    gradient_accumulation_steps: '4',
    learning_rate: '2e-5',
    warmup_ratio: '0.1',
    bf16: 'true',
    logging_steps: '10',
    save_strategy: 'epoch',
    use_peft: 'true',
    lora_r: '16',
    lora_alpha: '32',
    lora_dropout: '0.05',
    ...cfg.hyperparameters,
  };

  const command = new CreateTrainingJobCommand({
    TrainingJobName: jobName,
    RoleArn: roleArn,
    AlgorithmSpecification: {
      TrainingImage: trainingImage,
      TrainingInputMode: 'File',
    },
    InputDataConfig: [
      {
        ChannelName: 'train',
        DataSource: {
          S3DataSource: {
            S3DataType: 'S3Prefix',
            S3Uri: cfg.s3TrainDataUri,
            S3DataDistributionType: 'FullyReplicated',
          },
        },
        ContentType: 'application/jsonl',
      },
    ],
    OutputDataConfig: {
      S3OutputPath: outputPath,
    },
    ResourceConfig: {
      InstanceType: instanceType as TrainingInstanceType,
      InstanceCount: cfg.instanceCount || 1,
      VolumeSizeInGB: 100,
    },
    StoppingCondition: {
      MaxRuntimeInSeconds: cfg.maxRuntimeSeconds || 7200,
    },
    HyperParameters: hyperparameters,
  });

  await client.send(command);
  log.info({ jobName, baseModel, instanceType }, 'Training job started');

  return {
    jobName,
    status: 'InProgress',
    createdAt: new Date(),
  };
}

/**
 * Check the status of a SageMaker training job.
 */
export async function getTrainingJobStatus(jobName: string): Promise<TrainingJobStatus> {
  const client = getClient();

  const result = await client.send(
    new DescribeTrainingJobCommand({ TrainingJobName: jobName }),
  );

  return {
    jobName,
    status: result.TrainingJobStatus || 'Unknown',
    secondaryStatus: result.SecondaryStatus,
    modelArtifacts: result.ModelArtifacts?.S3ModelArtifacts,
    failureReason: result.FailureReason,
    createdAt: result.CreationTime,
    lastModifiedAt: result.LastModifiedTime,
  };
}

/**
 * List recent training jobs.
 */
export async function listTrainingJobs(maxResults = 10): Promise<TrainingJobStatus[]> {
  const client = getClient();

  const result = await client.send(
    new ListTrainingJobsCommand({
      MaxResults: maxResults,
      SortBy: 'CreationTime',
      SortOrder: 'Descending',
      NameContains: 'cerebro',
    }),
  );

  return (result.TrainingJobSummaries || []).map((j) => ({
    jobName: j.TrainingJobName || '',
    status: j.TrainingJobStatus || 'Unknown',
    createdAt: j.CreationTime,
    lastModifiedAt: j.LastModifiedTime,
  }));
}

/**
 * Deploy a trained model as a SageMaker real-time endpoint.
 * Uses HuggingFace TGI (Text Generation Inference) container.
 */
export async function deployModel(opts: {
  modelArtifactsS3Uri: string;
  endpointName: string;
  instanceType?: string;
}): Promise<EndpointInfo> {
  const client = getClient();
  const region = config.sagemaker.region;
  const roleArn = config.sagemaker.roleArn;
  const instanceType = opts.instanceType || config.sagemaker.inferenceInstanceType;
  const inferenceImage = HF_TGI_IMAGES[region];

  if (!inferenceImage) {
    throw new Error(`No HuggingFace TGI image configured for region ${region}`);
  }

  const modelName = `${opts.endpointName}-model`;
  const configName = `${opts.endpointName}-config`;

  await client.send(
    new CreateModelCommand({
      ModelName: modelName,
      ExecutionRoleArn: roleArn,
      PrimaryContainer: {
        Image: inferenceImage,
        ModelDataUrl: opts.modelArtifactsS3Uri,
        Environment: {
          HF_MODEL_ID: '/opt/ml/model',
          SM_NUM_GPUS: '1',
          MAX_INPUT_LENGTH: '2048',
          MAX_TOTAL_TOKENS: '4096',
        },
      },
    }),
  );

  await client.send(
    new CreateEndpointConfigCommand({
      EndpointConfigName: configName,
      ProductionVariants: [
        {
          VariantName: 'primary',
          ModelName: modelName,
          InstanceType: instanceType as ProductionVariantInstanceType,
          InitialInstanceCount: 1,
          InitialVariantWeight: 1,
        },
      ],
    }),
  );

  await client.send(
    new CreateEndpointCommand({
      EndpointName: opts.endpointName,
      EndpointConfigName: configName,
    }),
  );

  log.info({ endpointName: opts.endpointName, instanceType }, 'Endpoint deployment started');

  return {
    name: opts.endpointName,
    status: 'Creating',
    createdAt: new Date(),
  };
}

/**
 * Check the status of a SageMaker endpoint.
 */
export async function getEndpointStatus(endpointName: string): Promise<EndpointInfo> {
  const client = getClient();

  const result = await client.send(
    new DescribeEndpointCommand({ EndpointName: endpointName }),
  );

  return {
    name: endpointName,
    status: result.EndpointStatus || 'Unknown',
    createdAt: result.CreationTime,
  };
}

/**
 * List all cerebro-related endpoints.
 */
export async function listEndpoints(): Promise<EndpointInfo[]> {
  const client = getClient();

  const result = await client.send(
    new ListEndpointsCommand({
      NameContains: 'cerebro',
      SortBy: 'CreationTime',
      SortOrder: 'Descending',
    }),
  );

  return (result.Endpoints || []).map((e) => ({
    name: e.EndpointName || '',
    status: e.EndpointStatus || 'Unknown',
    createdAt: e.CreationTime,
  }));
}

/**
 * Tear down a deployed endpoint (endpoint + config + model).
 */
export async function deleteEndpoint(endpointName: string): Promise<void> {
  const client = getClient();
  const modelName = `${endpointName}-model`;
  const configName = `${endpointName}-config`;

  try {
    await client.send(new DeleteEndpointCommand({ EndpointName: endpointName }));
    log.info({ endpointName }, 'Endpoint deletion initiated');
  } catch (err: any) {
    log.warn({ err: err.message, endpointName }, 'Failed to delete endpoint');
  }

  // Wait briefly then clean up config and model
  await new Promise((r) => setTimeout(r, 5_000));

  try {
    await client.send(new DeleteEndpointConfigCommand({ EndpointConfigName: configName }));
  } catch { /* config may not exist */ }

  try {
    await client.send(new DeleteModelCommand({ ModelName: modelName }));
  } catch { /* model may not exist */ }
}

// ─── Inference ──────────────────────────────────────────────────────

export interface SageMakerInferenceRequest {
  messages: Array<{ role: string; content: string }>;
  tools?: any[];
  temperature?: number;
  max_tokens?: number;
}

export interface SageMakerInferenceResponse {
  content: string | null;
  toolCalls: Array<{
    id: string;
    type: string;
    function: { name: string; arguments: string };
  }>;
}

/**
 * Call a SageMaker endpoint for LLM inference.
 * Expects the endpoint to serve a model with OpenAI-compatible chat format
 * (as HuggingFace TGI does).
 */
export async function invokeEndpoint(
  endpointName: string,
  request: SageMakerInferenceRequest,
): Promise<SageMakerInferenceResponse> {
  const runtime = getRuntime();

  const payload: Record<string, any> = {
    inputs: '',
    parameters: {
      temperature: request.temperature ?? 0.1,
      max_new_tokens: request.max_tokens ?? 512,
      return_full_text: false,
    },
  };

  // Format as chat template for instruct models
  const chatPrompt = request.messages
    .map((m) => {
      if (m.role === 'system') return `[INST] <<SYS>>\n${m.content}\n<</SYS>>\n`;
      if (m.role === 'user') return `${m.content} [/INST]`;
      return m.content;
    })
    .join('\n');

  payload.inputs = chatPrompt;

  if (request.tools?.length) {
    payload.parameters.grammar = {
      type: 'json',
      value: buildToolCallSchema(request.tools),
    };
  }

  const result = await runtime.send(
    new InvokeEndpointCommand({
      EndpointName: endpointName,
      ContentType: 'application/json',
      Accept: 'application/json',
      Body: JSON.stringify(payload),
    }),
  );

  const responseBody = new TextDecoder().decode(result.Body);
  const parsed = JSON.parse(responseBody);

  const generatedText = Array.isArray(parsed)
    ? parsed[0]?.generated_text
    : parsed.generated_text || parsed[0]?.generated_text;

  const toolCalls = extractToolCallsFromText(generatedText || '');

  return {
    content: toolCalls.length > 0 ? null : (generatedText || null),
    toolCalls,
  };
}

/**
 * Build a JSON schema for constrained decoding of tool calls.
 */
function buildToolCallSchema(tools: any[]): Record<string, any> {
  const functionNames = tools
    .filter((t: any) => t.type === 'function')
    .map((t: any) => t.function.name);

  return {
    type: 'object',
    properties: {
      tool_call: {
        type: 'object',
        properties: {
          name: { type: 'string', enum: functionNames },
          arguments: { type: 'object' },
        },
        required: ['name', 'arguments'],
      },
    },
    required: ['tool_call'],
  };
}

/**
 * Parse tool calls from model output text.
 * Handles JSON-formatted tool call responses.
 */
function extractToolCallsFromText(
  text: string,
): Array<{ id: string; type: string; function: { name: string; arguments: string } }> {
  try {
    const parsed = JSON.parse(text.trim());
    if (parsed.tool_call) {
      return [
        {
          id: `sm_${Date.now()}`,
          type: 'function',
          function: {
            name: parsed.tool_call.name,
            arguments: JSON.stringify(parsed.tool_call.arguments || {}),
          },
        },
      ];
    }
  } catch {
    // Not JSON, try regex extraction
    const match = text.match(/\{[\s\S]*"tool_call"[\s\S]*\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        if (parsed.tool_call) {
          return [
            {
              id: `sm_${Date.now()}`,
              type: 'function',
              function: {
                name: parsed.tool_call.name,
                arguments: JSON.stringify(parsed.tool_call.arguments || {}),
              },
            },
          ];
        }
      } catch { /* ignore */ }
    }
  }

  return [];
}
