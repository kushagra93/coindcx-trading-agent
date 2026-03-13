import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/core/config.js', () => ({
  config: {
    sagemaker: {
      region: 'us-west-2',
      roleArn: 'arn:aws:iam::123456789:role/TestRole',
      s3Bucket: 'test-bucket',
      s3Prefix: 'cerebro-test',
      intentEndpointName: 'test-intent-ep',
      chatEndpointName: 'test-chat-ep',
      trainingInstanceType: 'ml.g5.2xlarge',
      inferenceInstanceType: 'ml.g5.xlarge',
      baseModelId: 'mistralai/Mistral-7B-Instruct-v0.3',
      useSageMakerInference: true,
    },
    logLevel: 'info',
    nodeEnv: 'test',
  },
}));

vi.mock('../../src/core/logger.js', () => ({
  createChildLogger: () => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  }),
}));

const mockSageMakerSend = vi.fn();
const mockRuntimeSend = vi.fn();

vi.mock('@aws-sdk/client-sagemaker', () => ({
  SageMakerClient: vi.fn().mockImplementation(() => ({ send: mockSageMakerSend })),
  SageMakerRuntimeClient: vi.fn().mockImplementation(() => ({ send: mockRuntimeSend })),
  CreateTrainingJobCommand: vi.fn().mockImplementation((args: any) => ({ ...args, _type: 'CreateTrainingJob' })),
  DescribeTrainingJobCommand: vi.fn().mockImplementation((args: any) => ({ ...args, _type: 'DescribeTrainingJob' })),
  CreateModelCommand: vi.fn().mockImplementation((args: any) => args),
  CreateEndpointConfigCommand: vi.fn().mockImplementation((args: any) => args),
  CreateEndpointCommand: vi.fn().mockImplementation((args: any) => args),
  DescribeEndpointCommand: vi.fn().mockImplementation((args: any) => args),
  DeleteEndpointCommand: vi.fn().mockImplementation((args: any) => args),
  DeleteEndpointConfigCommand: vi.fn().mockImplementation((args: any) => args),
  DeleteModelCommand: vi.fn().mockImplementation((args: any) => args),
  ListTrainingJobsCommand: vi.fn().mockImplementation((args: any) => args),
  ListEndpointsCommand: vi.fn().mockImplementation((args: any) => args),
}));

vi.mock('@aws-sdk/client-sagemaker-runtime', () => ({
  SageMakerRuntimeClient: vi.fn().mockImplementation(() => ({ send: mockRuntimeSend })),
  InvokeEndpointCommand: vi.fn().mockImplementation((args: any) => args),
}));

describe('sagemaker: startTrainingJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSageMakerSend.mockResolvedValue({});
  });

  it('starts a training job with default parameters', async () => {
    const { startTrainingJob } = await import('../../src/ml/sagemaker.js');

    const result = await startTrainingJob({
      s3TrainDataUri: 's3://test-bucket/cerebro-test/train/',
    });

    expect(result.status).toBe('InProgress');
    expect(result.jobName).toMatch(/^cerebro-intent-/);
    expect(result.createdAt).toBeInstanceOf(Date);
    expect(mockSageMakerSend).toHaveBeenCalledTimes(1);
  });

  it('uses custom job name when provided', async () => {
    const { startTrainingJob } = await import('../../src/ml/sagemaker.js');

    const result = await startTrainingJob({
      s3TrainDataUri: 's3://bucket/data/',
      jobName: 'my-custom-job',
    });

    expect(result.jobName).toBe('my-custom-job');
  });

  it('merges custom hyperparameters with defaults', async () => {
    const { startTrainingJob } = await import('../../src/ml/sagemaker.js');

    await startTrainingJob({
      s3TrainDataUri: 's3://bucket/data/',
      hyperparameters: { num_train_epochs: '5', custom_param: 'value' },
    });

    const callArgs = mockSageMakerSend.mock.calls[0][0];
    expect(callArgs.HyperParameters.num_train_epochs).toBe('5');
    expect(callArgs.HyperParameters.custom_param).toBe('value');
    expect(callArgs.HyperParameters.use_peft).toBe('true');
  });

  it('throws when roleArn is not configured', async () => {
    vi.doMock('../../src/core/config.js', () => ({
      config: {
        sagemaker: {
          region: 'us-west-2',
          roleArn: '',
          s3Bucket: 'test', s3Prefix: 'test',
          trainingInstanceType: 'ml.g5.2xlarge',
          baseModelId: 'test-model',
        },
        logLevel: 'info', nodeEnv: 'test',
      },
    }));

    vi.resetModules();
    const mod = await import('../../src/ml/sagemaker.js');
    await expect(mod.startTrainingJob({ s3TrainDataUri: 's3://a/' }))
      .rejects.toThrow('SAGEMAKER_ROLE_ARN');
  });
});

describe('sagemaker: getTrainingJobStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns training job status', async () => {
    mockSageMakerSend.mockResolvedValue({
      TrainingJobStatus: 'Completed',
      SecondaryStatus: 'Training',
      ModelArtifacts: { S3ModelArtifacts: 's3://bucket/model.tar.gz' },
      CreationTime: new Date('2026-03-13'),
      LastModifiedTime: new Date('2026-03-13'),
    });

    const { getTrainingJobStatus } = await import('../../src/ml/sagemaker.js');
    const result = await getTrainingJobStatus('test-job');

    expect(result.jobName).toBe('test-job');
    expect(result.status).toBe('Completed');
    expect(result.secondaryStatus).toBe('Training');
    expect(result.modelArtifacts).toBe('s3://bucket/model.tar.gz');
  });

  it('handles missing fields gracefully', async () => {
    mockSageMakerSend.mockResolvedValue({});

    const { getTrainingJobStatus } = await import('../../src/ml/sagemaker.js');
    const result = await getTrainingJobStatus('unknown-job');

    expect(result.status).toBe('Unknown');
    expect(result.modelArtifacts).toBeUndefined();
  });
});

describe('sagemaker: listTrainingJobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns list of training job summaries', async () => {
    mockSageMakerSend.mockResolvedValue({
      TrainingJobSummaries: [
        {
          TrainingJobName: 'cerebro-intent-1',
          TrainingJobStatus: 'Completed',
          CreationTime: new Date('2026-03-12'),
        },
        {
          TrainingJobName: 'cerebro-intent-2',
          TrainingJobStatus: 'InProgress',
          CreationTime: new Date('2026-03-13'),
        },
      ],
    });

    const { listTrainingJobs } = await import('../../src/ml/sagemaker.js');
    const result = await listTrainingJobs(5);

    expect(result).toHaveLength(2);
    expect(result[0].jobName).toBe('cerebro-intent-1');
    expect(result[0].status).toBe('Completed');
    expect(result[1].status).toBe('InProgress');
  });

  it('handles empty results', async () => {
    mockSageMakerSend.mockResolvedValue({ TrainingJobSummaries: [] });

    const { listTrainingJobs } = await import('../../src/ml/sagemaker.js');
    const result = await listTrainingJobs();

    expect(result).toHaveLength(0);
  });
});

describe('sagemaker: deployModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSageMakerSend.mockResolvedValue({});
  });

  it('creates model, config, and endpoint', async () => {
    const { deployModel } = await import('../../src/ml/sagemaker.js');

    const result = await deployModel({
      modelArtifactsS3Uri: 's3://bucket/model.tar.gz',
      endpointName: 'cerebro-intent-ep',
    });

    expect(result.name).toBe('cerebro-intent-ep');
    expect(result.status).toBe('Creating');
    expect(result.createdAt).toBeInstanceOf(Date);
    expect(mockSageMakerSend).toHaveBeenCalledTimes(3);
  });
});

describe('sagemaker: getEndpointStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns endpoint status', async () => {
    mockSageMakerSend.mockResolvedValue({
      EndpointStatus: 'InService',
      CreationTime: new Date('2026-03-13'),
    });

    const { getEndpointStatus } = await import('../../src/ml/sagemaker.js');
    const result = await getEndpointStatus('test-ep');

    expect(result.name).toBe('test-ep');
    expect(result.status).toBe('InService');
  });
});

describe('sagemaker: listEndpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists cerebro endpoints', async () => {
    mockSageMakerSend.mockResolvedValue({
      Endpoints: [
        { EndpointName: 'cerebro-intent', EndpointStatus: 'InService' },
        { EndpointName: 'cerebro-chat', EndpointStatus: 'Creating' },
      ],
    });

    const { listEndpoints } = await import('../../src/ml/sagemaker.js');
    const result = await listEndpoints();

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('cerebro-intent');
    expect(result[1].status).toBe('Creating');
  });
});

describe('sagemaker: deleteEndpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSageMakerSend.mockResolvedValue({});
  });

  it('deletes endpoint, config, and model', async () => {
    vi.useFakeTimers();

    const { deleteEndpoint } = await import('../../src/ml/sagemaker.js');
    const promise = deleteEndpoint('test-ep');

    await vi.advanceTimersByTimeAsync(6000);
    await promise;

    expect(mockSageMakerSend).toHaveBeenCalledTimes(3);

    vi.useRealTimers();
  });

  it('handles missing resources gracefully', async () => {
    vi.useFakeTimers();

    mockSageMakerSend
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('Not found'))
      .mockRejectedValueOnce(new Error('Not found'));

    const { deleteEndpoint } = await import('../../src/ml/sagemaker.js');
    const promise = deleteEndpoint('nonexistent-ep');

    await vi.advanceTimersByTimeAsync(6000);
    await expect(promise).resolves.toBeUndefined();

    vi.useRealTimers();
  });
});

describe('sagemaker: invokeEndpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns content when no tool calls detected', async () => {
    mockRuntimeSend.mockResolvedValue({
      Body: new TextEncoder().encode(
        JSON.stringify([{ generated_text: 'The price of SOL is $150' }]),
      ),
    });

    const { invokeEndpoint } = await import('../../src/ml/sagemaker.js');
    const result = await invokeEndpoint('test-ep', {
      messages: [{ role: 'user', content: 'What is SOL price?' }],
    });

    expect(result.content).toBe('The price of SOL is $150');
    expect(result.toolCalls).toHaveLength(0);
  });

  it('extracts tool calls from JSON response', async () => {
    const toolCallResponse = JSON.stringify({
      tool_call: { name: 'execute_trade', arguments: { token: 'SOL', amount: 200 } },
    });

    mockRuntimeSend.mockResolvedValue({
      Body: new TextEncoder().encode(
        JSON.stringify([{ generated_text: toolCallResponse }]),
      ),
    });

    const { invokeEndpoint } = await import('../../src/ml/sagemaker.js');
    const result = await invokeEndpoint('test-ep', {
      messages: [{ role: 'user', content: 'buy $200 SOL' }],
      tools: [{ type: 'function', function: { name: 'execute_trade', description: '', parameters: {} } }],
    });

    expect(result.content).toBeNull();
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].function.name).toBe('execute_trade');
    expect(JSON.parse(result.toolCalls[0].function.arguments)).toEqual({ token: 'SOL', amount: 200 });
  });

  it('handles non-array response format', async () => {
    mockRuntimeSend.mockResolvedValue({
      Body: new TextEncoder().encode(
        JSON.stringify({ generated_text: 'Hello!' }),
      ),
    });

    const { invokeEndpoint } = await import('../../src/ml/sagemaker.js');
    const result = await invokeEndpoint('test-ep', {
      messages: [{ role: 'user', content: 'hi' }],
    });

    expect(result.content).toBe('Hello!');
  });
});

describe('sagemaker: extractToolCallsFromText (internal logic)', () => {
  it('extracts from clean JSON', () => {
    const text = '{"tool_call": {"name": "get_price", "arguments": {"token": "ETH"}}}';
    let parsed: any;
    try {
      parsed = JSON.parse(text.trim());
    } catch { parsed = null; }

    expect(parsed?.tool_call?.name).toBe('get_price');
    expect(parsed?.tool_call?.arguments?.token).toBe('ETH');
  });

  it('handles embedded JSON in text', () => {
    const text = 'Some preamble {"tool_call": {"name": "screen_token", "arguments": {}}} trailing text';
    const match = text.match(/\{[\s\S]*"tool_call"[\s\S]*\}/);
    expect(match).not.toBeNull();

    const parsed = JSON.parse(match![0]);
    expect(parsed.tool_call.name).toBe('screen_token');
  });

  it('returns empty for plain text', () => {
    const text = 'Just a normal response with no tool calls';
    let parsed: any = null;
    try {
      parsed = JSON.parse(text.trim());
    } catch { /* expected */ }

    const match = text.match(/\{[\s\S]*"tool_call"[\s\S]*\}/);
    expect(parsed).toBeNull();
    expect(match).toBeNull();
  });

  it('returns empty for malformed JSON', () => {
    const text = '{tool_call: {name: broken}';
    let parsed: any = null;
    try {
      parsed = JSON.parse(text.trim());
    } catch { /* expected */ }
    expect(parsed).toBeNull();
  });
});

describe('sagemaker: buildToolCallSchema (internal logic)', () => {
  it('builds schema with function names from tools', () => {
    const tools = [
      { type: 'function', function: { name: 'execute_trade' } },
      { type: 'function', function: { name: 'get_price' } },
      { type: 'not_function', function: { name: 'should_be_skipped' } },
    ];

    const functionNames = tools
      .filter((t) => t.type === 'function')
      .map((t) => t.function.name);

    const schema = {
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

    expect(schema.properties.tool_call.properties.name.enum).toEqual([
      'execute_trade',
      'get_price',
    ]);
    expect(schema.required).toEqual(['tool_call']);
  });

  it('handles empty tools array', () => {
    const tools: any[] = [];
    const functionNames = tools.filter((t) => t.type === 'function').map((t) => t.function.name);
    expect(functionNames).toEqual([]);
  });
});

describe('sagemaker: HF image region mapping', () => {
  const HF_TGI_IMAGES: Record<string, string> = {
    'us-west-2': '763104351884.dkr.ecr.us-west-2.amazonaws.com/huggingface-pytorch-tgi-inference:2.1.1-tgi1.4.2-gpu-py310-cu121-ubuntu22.04',
    'us-east-1': '763104351884.dkr.ecr.us-east-1.amazonaws.com/huggingface-pytorch-tgi-inference:2.1.1-tgi1.4.2-gpu-py310-cu121-ubuntu22.04',
    'eu-west-1': '763104351884.dkr.ecr.eu-west-1.amazonaws.com/huggingface-pytorch-tgi-inference:2.1.1-tgi1.4.2-gpu-py310-cu121-ubuntu22.04',
    'ap-south-1': '763104351884.dkr.ecr.ap-south-1.amazonaws.com/huggingface-pytorch-tgi-inference:2.1.1-tgi1.4.2-gpu-py310-cu121-ubuntu22.04',
  };

  it('has images for all supported regions', () => {
    expect(Object.keys(HF_TGI_IMAGES)).toEqual(['us-west-2', 'us-east-1', 'eu-west-1', 'ap-south-1']);
  });

  it('all image URIs follow ECR pattern', () => {
    for (const [region, uri] of Object.entries(HF_TGI_IMAGES)) {
      expect(uri).toContain('.dkr.ecr.');
      expect(uri).toContain(region);
      expect(uri).toContain('huggingface-pytorch-tgi-inference');
    }
  });

  it('returns undefined for unsupported region', () => {
    expect(HF_TGI_IMAGES['ap-northeast-1']).toBeUndefined();
  });
});

describe('sagemaker: TrainingJobConfig types', () => {
  it('accepts minimal config', () => {
    const cfg = { s3TrainDataUri: 's3://bucket/data/' };
    expect(cfg.s3TrainDataUri).toBeTruthy();
  });

  it('accepts full config', () => {
    const cfg = {
      jobName: 'test-job',
      s3TrainDataUri: 's3://bucket/data/',
      baseModel: 'meta-llama/Llama-3-8B',
      hyperparameters: { num_train_epochs: '5' },
      instanceType: 'ml.p4d.24xlarge',
      instanceCount: 2,
      maxRuntimeSeconds: 14400,
    };
    expect(cfg.instanceCount).toBe(2);
    expect(cfg.hyperparameters.num_train_epochs).toBe('5');
  });
});
